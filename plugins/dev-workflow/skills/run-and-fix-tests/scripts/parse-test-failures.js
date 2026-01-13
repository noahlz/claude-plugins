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

  // Read results file
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
    matches.push(match[0]);
  }

  // Limit to 30 failures
  const MAX_FAILURES = 30;
  const totalFailures = matches.length;
  const truncated = totalFailures > MAX_FAILURES;
  const limitedMatches = matches.slice(0, MAX_FAILURES);

  // Parse failure details from matches
  const failures = limitedMatches.map(failureText => {
    // Try to extract test name and message
    // Common TAP pattern: "not ok 1 - test name"
    const tapPattern = /^not ok\s+\d+\s+-\s+(.+)$/;
    const tapMatch = failureText.match(tapPattern);

    if (tapMatch) {
      return {
        test: tapMatch[1].trim(),
        message: failureText.trim()
      };
    }

    // Fallback: return raw failure text
    return {
      message: failureText.trim()
    };
  });

  return {
    failures,
    totalFailures,
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
