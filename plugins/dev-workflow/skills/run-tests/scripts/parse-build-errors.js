#!/usr/bin/env node

import fs from 'fs';
import { readFileSafe, compilePattern } from '../../../lib/file-utils.js';

/**
 * Built-in format patterns for common build tools.
 * Each value is a regex pattern string used to identify error lines.
 */
export const FORMAT_REGISTRY = {
  maven:   '\\[ERROR\\]',
  // Matches Kotlin compiler errors (e:) or failed Gradle task lines
  gradle:  '(?:^e:\\s+|> Task .+ FAILED)',
  // TypeScript compiler: path(line,col): error TSxxxx: message
  tsc:     '^(?<file>[^(]+)\\((?<line>\\d+),(?<column>\\d+)\\):\\s+error\\s+(?<message>.+)',
  // GCC/Clang: path:line:col: error: message
  gcc:     '^(?<file>[^:]+):(?<line>\\d+):(?<column>\\d+):\\s+error:\\s+(?<message>.+)',
  cargo:   '^error(?:\\[E\\d+\\])?:',
  // Go compiler: path:line:col: message
  go:      '^(?<file>[^:]+):(?<line>\\d+):(?<column>\\d+):\\s+(?<message>.+)',
  generic: '(?:error|ERROR|Error).*'
};

/**
 * Parse build errors from log file
 * @param {string} filePath - Path to build log file
 * @param {string} pattern - Regex pattern to match error lines
 * @param {object} options - Options for dependency injection
 * @param {object} options.deps - Dependencies { fs }
 * @returns {object} - { errors, totalErrors, truncated }
 */
export function parseBuildErrors(filePath, pattern, options = {}) {
  const { deps = {} } = options;
  const fsModule = deps.fs || fs;

  if (!filePath) {
    throw new Error('filePath is required');
  }

  if (!pattern) {
    throw new Error('pattern is required');
  }

  const logContent = readFileSafe(filePath, { label: 'log file', fs: fsModule });
  const regex = compilePattern(pattern);

  // Extract errors
  const matches = [];
  let match;
  while ((match = regex.exec(logContent)) !== null) {
    matches.push(match);
  }

  // Limit to 30 errors
  const MAX_ERRORS = 30;
  const totalErrors = matches.length;
  const truncated = totalErrors > MAX_ERRORS;
  const limitedMatches = matches.slice(0, MAX_ERRORS);

  // Parse error details from matches
  const errors = limitedMatches.map(m => {
    const groups = m.groups || {};
    const errorText = m[0].trim();

    // Use named groups from format pattern if available
    if (groups.file || groups.line || groups.message) {
      return {
        ...(groups.file    && { file:    groups.file.trim() }),
        ...(groups.line    && { line:    parseInt(groups.line, 10) }),
        ...(groups.column  && { column:  parseInt(groups.column, 10) }),
        ...(groups.message && { message: groups.message.trim() }),
        // Fall back to full match as message if no message group
        ...(!groups.message && { message: errorText })
      };
    }

    // Fall back: try common file:line:col: message pattern
    const fileLinePattern = /^([^:\n]+):(\d+)(?::(\d+))?:\s*(.+)$/;
    const fileLineMatch = errorText.match(fileLinePattern);

    if (fileLineMatch) {
      return {
        file: fileLineMatch[1].trim(),
        line: parseInt(fileLineMatch[2], 10),
        column: fileLineMatch[3] ? parseInt(fileLineMatch[3], 10) : undefined,
        message: fileLineMatch[4].trim()
      };
    }

    return { message: errorText };
  });

  return {
    errors,
    totalErrors,
    truncated
  };
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
    const result = parseBuildErrors(args.file, pattern);

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
