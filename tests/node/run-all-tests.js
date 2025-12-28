#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

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
  const testFiles = findTestFiles(__dirname).sort();

  if (testFiles.length === 0) {
    console.log('No test files found');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test file(s):\n`);
  testFiles.forEach(file => {
    console.log(`  ${file.replace(__dirname, '.')}`);
  });
  console.log();

  // Run Node's test runner with all test files
  const result = spawnSync('node', ['--test', ...testFiles], {
    stdio: 'inherit',
    cwd: __dirname
  });

  process.exit(result.status);
}

runAllTests();
