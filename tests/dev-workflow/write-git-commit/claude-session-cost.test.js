import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath
} from '../../node/helpers.js';

describe('write-git-commit: claude-session-cost.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('returns valid JSON array for valid session ID', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should exit successfully');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.ok(Array.isArray(data), 'Output should be a JSON array');
    assert.ok(data.length > 0, 'Array should have at least one element');
  });

  it('includes required fields in output', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = JSON.parse(result.stdout);

    // Each element should have required fields
    data.forEach((item) => {
      assert.ok(item.model !== undefined, 'Should have model field');
      assert.ok(item.inputTokens !== undefined, 'Should have inputTokens field');
      assert.ok(item.outputTokens !== undefined, 'Should have outputTokens field');
      assert.ok(item.cost !== undefined, 'Should have cost field');
    });
  });

  it('does not include cache token fields', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = JSON.parse(result.stdout);

    data.forEach((item) => {
      assert.ok(!item.cacheCreationTokens, 'Should not have cacheCreationTokens');
      assert.ok(!item.cacheReadTokens, 'Should not have cacheReadTokens');
    });
  });

  it('handles multiple models in session', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = JSON.parse(result.stdout);

    // Mock ccusage returns 2 models
    assert.ok(data.length >= 2, 'Should have multiple models');
  });

  it('costs are rounded to 2 decimal places', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
      env: {
        SESSION_ID: '-Users-noahlz-projects-claude-plugins',
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = JSON.parse(result.stdout);

    data.forEach((item) => {
      const costStr = item.cost.toString();
      // Should be format: N.NN or N.N or N
      assert.match(costStr, /^\d+(\.\d{1,2})?$/, `Cost should be rounded to 2 decimals: ${costStr}`);
    });
  });

  it('errors when SESSION_ID not set', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
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
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
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
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'claude-session-cost.sh');

    const result = execBashScript(scriptPath, {
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
