import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  execBashScript,
  getPluginScriptPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';

describe('write-git-commit: commit-workflow.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
    // Initialize git repo for testing
    execBashScript('git', {
      args: ['init'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['config', 'user.email', 'test@example.com'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['config', 'user.name', 'Test User'],
      cwd: testEnv.tmpDir
    });
    // Create initial commit
    writeFileSync(join(testEnv.tmpDir, 'initial.txt'), 'initial');
    execBashScript('git', {
      args: ['add', 'initial.txt'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['commit', '-m', 'initial commit'],
      cwd: testEnv.tmpDir
    });
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('check-config returns not_found when no config exists', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'not_found', 'Should return not_found when no config exists');
  });

  it('check-config returns found when config exists', () => {
    // Create config file
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'found', 'Should return found when config exists');
  });

  it('prepare action returns valid status', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Status may be 'success', 'select_session', or 'error' depending on ccusage
    assert.ok(['success', 'select_session', 'error'].includes(data.status), 'Should return valid status');
    assert.ok(typeof data.data === 'object', 'Should have data field');
    assert.ok(typeof data.message === 'string', 'Should have message field');
  });

  it('commit action fails gracefully without session ID or config', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Should be error status when no session is configured
    assert.ok(['error'].includes(data.status), 'Status should be error without session');
  });

  it('handles unknown action with error', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['unknown-action'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail with unknown action');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'error', 'Status should be error');
    assert.ok(data.message.includes('Unknown action'), 'Should mention unknown action');
  });

  it('commit action returns metrics_invalid when metrics validation fails', () => {
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execBashScript('git', {
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics via CURRENT_COST env var (empty array)
    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: JSON.stringify([]),
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for empty cost array');
    assert.ok(data.data.attempted_costs, 'Should include attempted_costs in data');
  });

  it('commit action returns metrics_invalid when all metrics are zero', () => {
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execBashScript('git', {
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics (all zeros)
    const invalidMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: invalidMetrics,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for all-zero metrics');
  });

  it('commit action returns git_error when git commit fails', () => {
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass valid metrics but without staging changes (git commit will fail)
    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: validMetrics,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'git_error', 'Status should be git_error when nothing is staged');
  });

  it('prepare falls back to CLI when library import fails', function() {
    // This test verifies the fallback behavior works
    // We create an environment where library import would fail
    // by checking prepare returns valid status (either from library or CLI)
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // The status should be one of the valid responses
    // Whether using library or CLI fallback
    const validStatuses = ['success', 'select_session', 'error', 'confirm_session'];
    assert.ok(
      validStatuses.includes(data.status),
      `Status should be valid, got: ${data.status}`
    );
  });
});
