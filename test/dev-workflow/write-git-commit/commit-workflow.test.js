import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath
} from '../../lib/helpers.js';

describe('write-git-commit: commit-workflow.sh', () => {
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

  it('executes prepare action', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript('dev-workflow', scriptPath, {
      args: ['prepare'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should execute prepare action successfully');
  });

  it('executes commit action without body', () => {
    writeFileSync(join(testEnv.tmpDir, 'changed.txt'), 'changed');
    execBashScript('git', {
      args: ['add', 'changed.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript('dev-workflow', scriptPath, {
      args: ['commit', 'Test commit message'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should commit successfully');
  });

  it('executes commit action with body', () => {
    writeFileSync(join(testEnv.tmpDir, 'changed.txt'), 'changed');
    execBashScript('git', {
      args: ['add', 'changed.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript('dev-workflow', scriptPath, {
      args: ['commit', 'Test commit', 'Detailed commit body'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should commit with body successfully');
  });

  it('executes create-commit action', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript('dev-workflow', scriptPath, {
      args: ['create-commit', 'Commit message'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should handle gracefully (may not have staged changes)
    assert.ok(result.exitCode === 0 || result.stderr.includes('nothing to commit'), 'Should handle create-commit action');
  });

  it('handles unknown action gracefully', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript('dev-workflow', scriptPath, {
      args: ['unknown-action'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should fail or show usage
    assert.ok(result.exitCode !== 0 || result.stdout.includes('Usage'), 'Should reject unknown action');
  });

  it('script exists and is executable', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');
    const stat = execBashScript('dev-workflow', 'test', {
      args: ['-x', scriptPath]
    });

    assert.equal(stat.exitCode, 0, 'Script should be executable');
  });
});
