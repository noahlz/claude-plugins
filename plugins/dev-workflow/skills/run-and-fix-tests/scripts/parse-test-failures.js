#!/usr/bin/env node

import fs from 'fs';
import { globSync } from 'fs';
import path from 'path';
import { loadConfig } from './load-config.js';

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

  // Compile regex for presence check
  let regex;
  try {
    regex = new RegExp(errorPattern, 'gm');
  } catch (err) {
    throw new Error(`Invalid regex pattern "${errorPattern}": ${err.message}`);
  }

  // Check each file for failures
  const fileFailures = [];
  const MAX_FAILURES = 30;

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
      fileFailures.push({
        file: pathModule.basename(filePath),
        count
      });
    }

    // Stop if we've hit the limit
    if (fileFailures.length >= MAX_FAILURES) {
      break;
    }
  }

  const totalFailures = fileFailures.reduce((sum, f) => sum + f.count, 0);
  const truncated = fileFailures.length >= MAX_FAILURES && files.length > fileFailures.length;

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
 * Parse test failures from results file
 * @param {object} config - Configuration object
 * @param {object} options - Options for dependency injection
 * @param {object} options.deps - Dependencies { fs }
 * @returns {object} - { failures, totalFailures, truncated }
 */
export function parseTestFailures(config, options = {}) {
  const { deps = {} } = options;
  const fsModule = deps.fs || fs;

  // Validate config
  if (!config || !config.test || !config.test.all) {
    throw new Error('Config must have "test.all" property');
  }

  const { resultsPath, errorPattern } = config.test.all;

  if (!resultsPath) {
    throw new Error('test.all.resultsPath is required');
  }

  if (!errorPattern) {
    throw new Error('test.all.errorPattern is required');
  }

  // Check if resultsPath contains glob pattern
  if (hasGlobPattern(resultsPath)) {
    return parseGlobResults(resultsPath, errorPattern, deps);
  }

  // File mode: Read results file
  let resultsContent;
  try {
    resultsContent = fsModule.readFileSync(resultsPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read results file at ${resultsPath}: ${err.message}`);
  }

  // Parse regex pattern
  let regex;
  try {
    regex = new RegExp(errorPattern, 'gm');
  } catch (err) {
    throw new Error(`Invalid regex pattern "${errorPattern}": ${err.message}`);
  }

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

  // Warn if file has content but pattern matched nothing (format mismatch)
  const result = {
    mode: 'file',
    failures,
    totalFailures,
    truncated
  };

  if (totalFailures === 0 && resultsContent.trim().length > 10) {
    result.warning = 'Results file has content but errorPattern matched nothing. Output format may not match configured pattern.';
  }

  return result;
}

/* node:coverage disable */
/**
 * Main entry point
 */
function main() {
  try {
    // Load and resolve config
    const { resolved: config, errors } = loadConfig();

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    // Parse test failures
    const result = parseTestFailures(config);

    // Output result as JSON
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
