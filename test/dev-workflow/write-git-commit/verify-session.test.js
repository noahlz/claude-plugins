import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  getPluginScriptPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';

describe('write-git-commit: verify-session.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('returns error when no session ID provided', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail without session ID');

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    assert.equal(data.status, 'error', 'Status should be error');
    assert.ok(data.message.includes('Usage') || data.message.includes('session'), 'Should mention session or usage');
  });

  it('handles valid session ID format gracefully', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['-Users-noahlz-projects-claude-plugins'],
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Status may be 'verified', 'not_found', or 'error' depending on ccusage availability
    assert.ok(['verified', 'not_found', 'error'].includes(data.status), 'Status should be one of: verified, not_found, error');

    // If verified, should have session_id
    if (data.status === 'verified') {
      assert.ok(data.data.session_id, 'Should include session_id in data when verified');
    }
  });

  it('handles nonexistent session ID gracefully', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['-nonexistent-session-id-xyz'],
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Should either be not_found or error (depending on ccusage availability)
    assert.ok(['not_found', 'error'].includes(data.status), 'Status should be not_found or error');
  });

  it('outputs valid JSON format', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'verify-session.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['-Users-noahlz-projects-claude-plugins'],
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    assert.ok(data.status, 'Should have status field');
    assert.ok(typeof data.data === 'object', 'Should have data field');
    assert.ok(typeof data.message === 'string', 'Should have message field');
  });
});
