#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(dirname(__dirname), 'dist');
const tapLogFile = join(distDir, 'test-results.tap');

mkdirSync(distDir, { recursive: true });

const result = spawnSync(
  'node',
  [
    '--test',
    '--test-reporter=spec',
    '--test-reporter=tap',
    '--test-reporter-destination=stdout',
    `--test-reporter-destination=${tapLogFile}`,
    join(__dirname, 'dev-workflow/**/*.test.js')
  ],
  {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: dirname(__dirname),
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '1' }
  }
);

const lines = ((result.stdout || '') + (result.stderr || '')).split('\n');
const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
const summaryStart = lines.findIndex(line => stripAnsi(line).trim().startsWith('ℹ tests'));

if (summaryStart === -1) {
  console.log(lines.join('\n'));
  process.exit(result.status);
}

let summaryEnd = summaryStart;
while (summaryEnd + 1 < lines.length && stripAnsi(lines[summaryEnd + 1]).trim().startsWith('ℹ')) {
  summaryEnd++;
}

const reordered = [
  ...lines.slice(0, summaryStart),
  ...lines.slice(summaryEnd + 1),
  '',
  '======== TEST RESULTS ========',
  '',
  ...lines.slice(summaryStart, summaryEnd + 1)
];

console.log(reordered.join('\n'));
process.exit(result.status);
