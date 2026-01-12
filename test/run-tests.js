import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(dirname(__dirname), 'dist');

// Get test files from command line args or default to all tests
const args = process.argv.slice(2);
const isSingleTestMode = args.length > 0;

const isSilent = process.env.npm_config_loglevel === 'silent' || process.env.npm_config_silent === 'true';

// Use different result files for single vs all tests
const tapLogFile = join(distDir, isSingleTestMode ? 'test-single-results.tap' : 'test-results.tap');

mkdirSync(distDir, { recursive: true });

const testFiles = isSingleTestMode
  ? args
  : globSync('**/*.test.js', { cwd: __dirname }).map(file => join(__dirname, file));

const testEnv = {
  ...process.env,
  FORCE_COLOR: '1'
};

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
    cwd: dirname(__dirname),
    encoding: 'utf-8',
    env: testEnv
  }
);

const lines = ((result.stdout || '') + (result.stderr || '')).split('\n');
const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
const summaryStart = lines.findIndex(line => stripAnsi(line).trim().startsWith('ℹ tests'));

if (summaryStart === -1) {
  if (!isSilent) console.log(lines.join('\n'));
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

if (!isSilent) {
  console.log(reordered.join('\n'));
}

process.exit(result.status);
