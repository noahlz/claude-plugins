#!/usr/bin/env node

import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // test/ directory

/**
 * Recursively find all .test.js files
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of test file paths
 */
function findTestFiles(dir) {
  const files = [];

  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Run all tests using Node's built-in test runner
 */
function runAllTests() {
  // Search for tests in dev-workflow/ directory
  const devWorkflowDir = join(__dirname, 'dev-workflow');
  const testFiles = findTestFiles(devWorkflowDir).sort();

  if (testFiles.length === 0) {
    console.log('No test files found');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test file(s):\n`);
  testFiles.forEach(file => {
    console.log(`  ${file.replace(__dirname, 'test')}`);
  });
  console.log();

  // Create dist directory for TAP output
  const distDir = join(dirname(__dirname), 'dist');
  mkdirSync(distDir, { recursive: true });

  const tapLogFile = join(distDir, 'test-results.tap');

  // Force colors in output even when captured, so interactive terminals show colors
  const env = { ...process.env, FORCE_COLOR: '1' };

  // Always capture output so we can reorder summary consistently
  const result = spawnSync(
    'node',
    [
      '--test',
      '--test-reporter=spec',
      '--test-reporter=tap',
      '--test-reporter-destination=stdout',
      `--test-reporter-destination=${tapLogFile}`,
      ...testFiles
    ],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: __dirname,
      encoding: 'utf-8',
      env
    }
  );

  // Combine stdout and stderr for processing (Node's test runner uses both)
  const output = (result.stdout || '') + (result.stderr || '');

  // Split output into lines for processing
  const lines = output.split('\n');

  // Helper to strip ANSI codes for pattern matching
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

  // Find summary block (starts with "ℹ tests")
  const summaryStartIdx = lines.findIndex(line => stripAnsi(line).trim().startsWith('ℹ tests'));

  if (summaryStartIdx !== -1) {
    // Find the end of the summary block (all consecutive ℹ lines)
    let summaryEndIdx = summaryStartIdx;
    for (let i = summaryStartIdx + 1; i < lines.length; i++) {
      if (stripAnsi(lines[i]).trim().startsWith('ℹ')) {
        summaryEndIdx = i;
      } else {
        break;
      }
    }

    // Extract the summary lines
    const summaryLines = lines.slice(summaryStartIdx, summaryEndIdx + 1);

    // Find where "✖ failing tests:" section starts (if any)
    const failuresSectionIdx = lines.findIndex((line, idx) =>
      idx > summaryEndIdx && stripAnsi(line).trim().startsWith('✖ failing tests')
    );

    // Build output in correct order: progress → failures → summary
    let outputLines = [];

    if (failuresSectionIdx !== -1) {
      // We have failures section
      // Part 1: Everything before summary (test progress)
      outputLines.push(...lines.slice(0, summaryStartIdx));

      // Part 2: Everything from failures section onward
      outputLines.push(...lines.slice(failuresSectionIdx));

      // Part 3: Banner + Summary at the very end
      outputLines.push('');
      outputLines.push('======== TEST RESULTS ========');
      outputLines.push('');
      outputLines.push(...summaryLines);
    } else {
      // No failures section - just move summary to end
      outputLines.push(...lines.slice(0, summaryStartIdx));
      outputLines.push('');
      outputLines.push('======== TEST RESULTS ========');
      outputLines.push('');
      outputLines.push(...summaryLines);
    }

    // Print the reordered output
    console.log(outputLines.join('\n'));
  } else {
    // No summary found, print output as-is
    console.log(output);
  }

  process.exit(result.status);
}

runAllTests();
