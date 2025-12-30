import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getPluginScriptPath,
  execNodeScript,
  extractJsonFromOutput
} from '../../lib/helpers.js';

describe('write-git-commit: new single-purpose scripts', () => {
  describe('verify-session-library.js', () => {
    it('returns error when no session ID provided', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session-library.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: []
      });

      assert.notEqual(result.exitCode, 0, 'Should exit with error code');

      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'error', 'Status should be error');
      assert.equal(data.exists, false, 'Exists should be false');
      assert.ok(data.message.includes('Usage'), 'Should show usage message');
    });

    it('returns error structure for nonexistent sessions', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session-library.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: ['-nonexistent-fake-session-id-xyz']
      });

      // When library works but session is not found, exit code is 0 (successful query)
      // Extract JSON from output lines (ignore debug messages like "[ccusage] ℹ ...")
      const lines = result.stdout.split('\n');
      let data;
      for (const line of lines) {
        try {
          data = JSON.parse(line);
          break;
        } catch (e) {
          // Skip non-JSON lines
        }
      }

      assert.ok(data, 'Output should contain valid JSON');
      assert.equal(data.status, 'success', 'Status should be success when library responds');
      assert.equal(data.exists, false, 'Exists should be false when session not found');
    });
  });

  describe('verify-session-cli.js', () => {
    it('returns error when no session ID provided', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session-cli.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: []
      });

      assert.notEqual(result.exitCode, 0, 'Should exit with error code');

      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'error', 'Status should be error');
      assert.equal(data.exists, false, 'Exists should be false');
      assert.ok(data.message.includes('Usage'), 'Should show usage message');
    });

    it('returns success even when session not found (still valid CLI response)', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session-cli.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: ['-nonexistent-fake-session-xyz']
      });

      // CLI call succeeds even if session not found
      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'success', 'Status should be success when CLI responds');
      assert.equal(data.exists, false, 'Exists should be false when session not found');
    });
  });

  describe('get-session-costs-library.js', () => {
    it('returns error when no session ID provided', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'get-session-costs-library.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: []
      });

      assert.notEqual(result.exitCode, 0, 'Should exit with error code');

      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'error', 'Status should be error');
      assert.deepEqual(data.data, [], 'Data should be empty array');
      assert.ok(data.message.includes('Usage'), 'Should show usage message');
    });

    it('returns error for nonexistent session', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'get-session-costs-library.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: ['-nonexistent-session']
      });

      // Extract JSON from output (ignoring any debug messages)
      const lines = result.stdout.split('\n');
      let data;
      for (const line of lines) {
        try {
          data = JSON.parse(line);
          break;
        } catch (e) {
          // Skip non-JSON lines (debug output)
        }
      }

      assert.ok(data, `Output should contain valid JSON`);
      assert.equal(data.status, 'error', 'Status should be error for nonexistent session');
      assert.ok(Array.isArray(data.data), 'Data should be array');
      assert.ok(typeof data.message === 'string', 'Message should be string');
    });
  });

  describe('get-session-costs-cli.js', () => {
    it('returns error when no session ID provided', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'get-session-costs-cli.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: []
      });

      assert.notEqual(result.exitCode, 0, 'Should exit with error code');

      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'error', 'Status should be error');
      assert.deepEqual(data.data, [], 'Data should be empty array');
      assert.ok(data.message.includes('Usage'), 'Should show usage message');
    });

    it('returns valid JSON structure on CLI error', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'get-session-costs-cli.js');

      const result = execNodeScript('dev-workflow', scriptPath, {
        args: ['-nonexistent-session'],
        env: {
          PATH: '/nonexistent'
        }
      });

      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch (e) {
        assert.fail(`Output should be valid JSON: ${result.stdout}`);
      }

      assert.equal(data.status, 'error', 'Status should be error');
      assert.ok(Array.isArray(data.data), 'Data should be array');
      assert.ok(typeof data.message === 'string', 'Message should be string');
    });
  });
});
