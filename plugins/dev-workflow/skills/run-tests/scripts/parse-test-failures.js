#!/usr/bin/env node

import { globSync } from 'fs';
import fs from 'fs';
import path from 'path';
import { readFileSafe, compilePattern } from '../../../lib/file-utils.js';

/**
 * Built-in format patterns for common test runners.
 * Each value is a regex pattern string used to identify failure lines.
 * Patterns use named groups where possible for richer extraction.
 */
export const FORMAT_REGISTRY = {
  tap:      '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$',
  // junit-xml uses glob mode — matches <failure elements in XML report files
  'junit-xml': '<failure',
  pytest:   '^FAILED\\s+(?<testName>.+)$',
  go:       '^---\\s+FAIL:\\s+(?<testName>\\S+)',
  jest:     '^\\s+FAIL\\s+(?<file>.+)$',
  mocha:    '^\\s+\\d+\\)\\s+(?<testName>.+)$',
  rspec:    '^rspec\\s+(?<file>[^:]+):(?<line>\\d+)',
  dotnet:   '^\\s+Failed\\s+(?<testName>.+)\\s+\\[',
  cargo:    '^test\\s+(?<testName>\\S+)\\s+\\.\\.\\.\\s+FAILED',
  generic:  '(?:FAIL|ERROR|FAILED).*'
};

/**
 * Check if path contains glob patterns
 * @param {string} resultsPath - Path to check
 * @returns {boolean} - True if path contains glob characters
 */
function hasGlobPattern(resultsPath) {
  return /[*?[\]]/.test(resultsPath);
}

/**
 * Parse test failures from multiple files matching glob pattern
 * @param {string} resultsPath - Glob pattern
 * @param {string} errorPattern - Pattern to search for in files
 * @param {object} deps - Dependencies { fs, path, globSync }
 * @returns {object} - { mode, failures, totalFailures, truncated }
 */
function parseGlobResults(resultsPath, errorPattern, deps = {}) {
  const fsModule = deps.fs || fs;
  const pathModule = deps.path || path;
  const globFn = deps.globSync || globSync;

  // Find files matching glob pattern
  const files = globFn(resultsPath);

  if (files.length === 0) {
    return {
      mode: 'glob',
      failures: [],
      totalFailures: 0,
      truncated: false
    };
  }

  const regex = compilePattern(errorPattern);

  // Check each file for failures — scan ALL files for totalFailures, but cap the display list
  const fileFailures = [];
  const MAX_FAILURES = 30;
  let totalFailures = 0;

  for (const filePath of files) {
    const content = fsModule.readFileSync(filePath, 'utf8');

    // Reset regex state
    regex.lastIndex = 0;

    // Count matches in this file
    let count = 0;
    while (regex.exec(content) !== null) {
      count++;
    }

    if (count > 0) {
      totalFailures += count;
      // Only add to the display list if we haven't hit the cap
      if (fileFailures.length < MAX_FAILURES) {
        fileFailures.push({
          file: pathModule.basename(filePath),
          count
        });
      }
    }
  }

  const truncated = fileFailures.length >= MAX_FAILURES && totalFailures > fileFailures.reduce((sum, f) => sum + f.count, 0);

  return {
    mode: 'glob',
    failures: fileFailures.slice(0, MAX_FAILURES),
    totalFailures,
    truncated
  };
}

/**
 * Build failure object from regex match
 * @param {RegExpMatchArray} match - Regex match object
 * @returns {object} - Failure object with extracted fields
 */
function buildFailureObject(match) {
  const groups = match.groups || {};
  const fullMatch = match[0].trim();

  const failure = {
    message: fullMatch  // Default to full matched text
  };

  // Extract named groups if present
  if (groups.testName) {
    failure.test = groups.testName.trim();
  }
  if (groups.testClass) {
    failure.testClass = groups.testClass.trim();
  }
  if (groups.message) {
    failure.message = groups.message.trim();
  }
  if (groups.file) {
    failure.file = groups.file.trim();
  }
  if (groups.line) {
    failure.line = parseInt(groups.line, 10);
  }

  return failure;
}

/**
 * Parse test failures from results file or glob pattern
 * @param {string} filePath - Path to results file (or glob pattern)
 * @param {string} pattern - Regex pattern to match failures
 * @param {object} options - Options for dependency injection
 * @param {object} options.deps - Dependencies { fs, path, globSync }
 * @returns {object} - { mode, failures, totalFailures, truncated }
 */
export function parseTestFailures(filePath, pattern, options = {}) {
  const { deps = {} } = options;
  const fsModule = deps.fs || fs;

  if (!filePath) {
    throw new Error('filePath is required');
  }

  if (!pattern) {
    throw new Error('pattern is required');
  }

  // Check if filePath contains glob pattern
  if (hasGlobPattern(filePath)) {
    return parseGlobResults(filePath, pattern, deps);
  }

  // File mode: Read results file
  const resultsContent = readFileSafe(filePath, { label: 'results file', fs: fsModule });
  const regex = compilePattern(pattern);

  // Extract failures
  const matches = [];
  let match;
  while ((match = regex.exec(resultsContent)) !== null) {
    matches.push(match);
  }

  // Limit to 30 failures
  const MAX_FAILURES = 30;
  const totalFailures = matches.length;
  const truncated = totalFailures > MAX_FAILURES;
  const limitedMatches = matches.slice(0, MAX_FAILURES);

  // Parse failure details from matches
  const failures = limitedMatches.map(match => buildFailureObject(match));

  const result = {
    mode: 'file',
    failures,
    totalFailures,
    truncated
  };

  if (totalFailures === 0 && resultsContent.trim().length > 10) {
    result.warning = 'Results file has content but pattern matched nothing. Output format may not match the pattern.';
  }

  return result;
}

/* node:coverage disable */
/**
 * Resolve pattern from CLI args: --pattern takes precedence over --format
 * @param {string} format - Format name from --format arg
 * @param {string} pattern - Raw pattern from --pattern arg
 * @returns {string} - Resolved pattern string
 */
function resolvePattern(format, pattern) {
  if (pattern) return pattern;
  if (format) {
    const resolved = FORMAT_REGISTRY[format];
    if (!resolved) {
      throw new Error(`Unknown format "${format}". Known formats: ${Object.keys(FORMAT_REGISTRY).join(', ')}`);
    }
    return resolved;
  }
  return FORMAT_REGISTRY.generic;
}

/**
 * Main entry point
 */
function main() {
  try {
    const argv = process.argv.slice(2);
    const args = {};
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--file' && argv[i + 1] !== undefined) args.file = argv[++i];
      else if (argv[i] === '--format' && argv[i + 1] !== undefined) args.format = argv[++i];
      else if (argv[i] === '--pattern' && argv[i + 1] !== undefined) args.pattern = argv[++i];
    }

    if (!args.file) {
      throw new Error('--file is required');
    }

    const pattern = resolvePattern(args.format, args.pattern);
    const result = parseTestFailures(args.file, pattern);

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
/* node:coverage enable */
