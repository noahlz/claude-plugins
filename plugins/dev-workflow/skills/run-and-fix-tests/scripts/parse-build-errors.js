#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';

/**
 * Read input from stdin
 * @returns {Promise<string>} - Input string
 */
async function readStdin() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  let input = '';
  for await (const line of rl) {
    input += line + '\n';
  }
  return input.trim();
}

/**
 * Parse build errors from log file
 * @param {object} config - Configuration object
 * @param {object} options - Options for dependency injection
 * @param {object} options.deps - Dependencies { fs }
 * @returns {object} - { errors, totalErrors, truncated }
 */
export function parseBuildErrors(config, options = {}) {
  const { deps = {} } = options;
  const fsModule = deps.fs || fs;

  // Validate config
  if (!config || !config.build) {
    throw new Error('Config must have "build" property');
  }

  const { logFile, errorPattern } = config.build;

  if (!logFile) {
    throw new Error('build.logFile is required');
  }

  if (!errorPattern) {
    throw new Error('build.errorPattern is required');
  }

  // Read log file
  let logContent;
  try {
    logContent = fsModule.readFileSync(logFile, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read log file at ${logFile}: ${err.message}`);
  }

  // Parse regex pattern
  let regex;
  try {
    regex = new RegExp(errorPattern, 'gm');
  } catch (err) {
    throw new Error(`Invalid regex pattern "${errorPattern}": ${err.message}`);
  }

  // Extract errors
  const matches = [];
  let match;
  while ((match = regex.exec(logContent)) !== null) {
    matches.push(match[0]);
  }

  // Limit to 30 errors
  const MAX_ERRORS = 30;
  const totalErrors = matches.length;
  const truncated = totalErrors > MAX_ERRORS;
  const limitedMatches = matches.slice(0, MAX_ERRORS);

  // Parse error details from matches
  const errors = limitedMatches.map(errorText => {
    // Try to extract file, line, and message
    // Common patterns: "path/to/file.ts:42:5: Error message"
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

    // Fallback: return raw error text
    return {
      message: errorText.trim()
    };
  });

  return {
    errors,
    totalErrors,
    truncated
  };
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Read config from stdin
    const input = await readStdin();
    const config = JSON.parse(input);

    // Parse build errors
    const result = parseBuildErrors(config);

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
