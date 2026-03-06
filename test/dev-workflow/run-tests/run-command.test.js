import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPT = join(__dirname, '../../../plugins/dev-workflow/skills/run-tests/scripts/run-command.js');

function runScript(args, env = {}) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

describe('run-tests: run-command.js', () => {
  let testEnv;

  beforeEach(() => { testEnv = setupTestEnv(); });
  afterEach(() => { teardownTestEnv(testEnv); });

  describe('capturing output', () => {
    it('captures stdout and writes to output file', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const result = runScript(['--cmd', 'echo hello', '--out', outFile]);

      assert.equal(result.status, 0, 'Script should exit 0');
      const json = JSON.parse(result.stdout);
      assert.equal(json.exitCode, 0);
      assert.equal(json.outputFile, outFile);

      const output = readFileSync(outFile, 'utf8');
      assert.match(output, /hello/);
    });

    it('captures stderr output in the output file', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const cmd = `node -e "process.stderr.write('error output')"`;
      const result = runScript(['--cmd', cmd, '--out', outFile]);

      assert.equal(result.status, 0);
      const output = readFileSync(outFile, 'utf8');
      assert.match(output, /error output/);
    });

    it('captures both stdout and stderr in the output file', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const cmd = `node -e "process.stdout.write('stdout line\\n'); process.stderr.write('stderr line\\n')"`;
      const result = runScript(['--cmd', cmd, '--out', outFile]);

      assert.equal(result.status, 0);
      const output = readFileSync(outFile, 'utf8');
      assert.match(output, /stdout line/);
      assert.match(output, /stderr line/);
    });
  });

  describe('exit code passthrough', () => {
    it('returns exit code 0 for successful command', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const result = runScript(['--cmd', 'node -e "process.exit(0)"', '--out', outFile]);

      assert.equal(result.status, 0, 'Script itself exits 0');
      const json = JSON.parse(result.stdout);
      assert.equal(json.exitCode, 0);
    });

    it('returns non-zero exit code from command', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const result = runScript(['--cmd', 'node -e "process.exit(42)"', '--out', outFile]);

      assert.equal(result.status, 0, 'Script itself exits 0');
      const json = JSON.parse(result.stdout);
      assert.equal(json.exitCode, 42);
    });
  });

  describe('directory creation', () => {
    it('creates parent directories for nested output file path', () => {
      const outFile = join(testEnv.tmpDir, 'nested/deep/test.log');
      const result = runScript(['--cmd', 'echo test', '--out', outFile]);

      assert.equal(result.status, 0);
      // File should be readable — throws if directory was not created
      readFileSync(outFile);
    });
  });

  describe('argument validation', () => {
    it('exits with error when --cmd is missing', () => {
      const outFile = join(testEnv.tmpDir, 'test.log');
      const result = runScript(['--out', outFile]);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /--cmd/);
    });

    it('exits with error when --out is missing', () => {
      const result = runScript(['--cmd', 'echo test']);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /--out/);
    });
  });
});
