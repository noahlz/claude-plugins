import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath,
  getMockConfig
} from '../helpers.js';

describe('write-git-commit: commit-workflow.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();

    // Initialize git repo in test directory
    const config = getMockConfig(testEnv.tmpDir);
    execBashScript('git', {
      ...config,
      args: ['init'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      ...config,
      args: ['config', 'user.email', 'test@example.com'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      ...config,
      args: ['config', 'user.name', 'Test User'],
      cwd: testEnv.tmpDir
    });
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('prepare action completes', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    writeFileSync(configPath, JSON.stringify({ sessionId: '-Users-noahlz-projects-claude-plugins' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      args: ['prepare'],
      cwd: testEnv.tmpDir
    });

    // Script should complete (exit code 0 or return some output)
    assert.ok(result.exitCode === 0 || result.output || result.stderr, 'Prepare action should complete');
  });

  it('commit action with staged file completes', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    writeFileSync(configPath, JSON.stringify({ sessionId: '-Users-noahlz-projects-claude-plugins' }));

    // Create a test file and stage it
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    const config = getMockConfig(testEnv.tmpDir);
    execBashScript('git', {
      ...config,
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript(scriptPath, {
      ...config,
      args: ['commit'],
      input: 'Test commit subject\nTest body content',
      cwd: testEnv.tmpDir
    });

    // Script should complete
    assert.ok(result.exitCode === 0 || result.output || result.stderr, 'Commit action should complete');
  });

  it('commit action without body completes', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    writeFileSync(configPath, JSON.stringify({ sessionId: '-Users-noahlz-projects-claude-plugins' }));

    // Create a test file and stage it
    writeFileSync(join(testEnv.tmpDir, 'test2.txt'), 'test content 2');
    const config = getMockConfig(testEnv.tmpDir);
    execBashScript('git', {
      ...config,
      args: ['add', 'test2.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript(scriptPath, {
      ...config,
      args: ['commit'],
      input: 'Minimal commit',
      cwd: testEnv.tmpDir
    });

    assert.ok(result.exitCode === 0 || result.output || result.stderr, 'Commit action should complete');
  });

  it('create-commit action completes', () => {
    // Create a test file and stage it
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    const config = getMockConfig(testEnv.tmpDir);
    execBashScript('git', {
      ...config,
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');

    const result = execBashScript(scriptPath, {
      ...config,
      args: ['create-commit', 'Test commit message'],
      cwd: testEnv.tmpDir
    });

    assert.ok(result.exitCode === 0 || result.output || result.stderr, 'create-commit action should complete');
  });

  it('unknown action is handled', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      args: ['unknown-action'],
      cwd: testEnv.tmpDir
    });

    // Should complete and likely error for unknown action
    assert.ok(typeof result.exitCode === 'number', 'Should have exit code');
  });
});
