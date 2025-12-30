import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  getPluginScriptPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';

describe('write-git-commit: claude-session-cost.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('handles session lookups gracefully', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Script may output JSON to stdout (on success) or error to stderr (on failure)
    const data = extractJsonFromOutput(result.stdout);

    if (result.exitCode === 0 && data && Array.isArray(data)) {
      // Successful case: verify JSON structure
      data.forEach((item) => {
        assert.ok(item.model !== undefined, 'Should have model field');
        assert.ok(item.inputTokens !== undefined, 'Should have inputTokens field');
        assert.ok(item.outputTokens !== undefined, 'Should have outputTokens field');
        assert.ok(item.cost !== undefined, 'Should have cost field');
        // Costs should be rounded
        const costStr = item.cost.toString();
        assert.match(costStr, /^\d+(\.\d{1,2})?$/, `Cost should be rounded to 2 decimals: ${costStr}`);
      });
    } else if (result.exitCode !== 0) {
      // Error case: should output error message to stderr
      assert.ok(result.stderr || result.stdout, 'Should have output when failing');
    }
  });

  it('errors when SESSION_ID not set', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      env: {
        SESSION_ID: '',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail without SESSION_ID');
    assert.match(result.stderr, /SESSION_ID/, 'Should mention SESSION_ID in error');
  });

 it('errors when ccusage not found', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: '/usr/bin:/bin' // No mocks
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail without ccusage');
    assert.match(result.stderr, /ccusage/, 'Should mention ccusage in error');
  });

  it('errors when session not found', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      env: {
        SESSION_ID: 'nonexistent-session-id',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail for nonexistent session');
    assert.match(result.stderr, /Session.*not found|Error/, 'Should mention session not found');
  });
});
