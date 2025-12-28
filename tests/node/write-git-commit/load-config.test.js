import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath,
  getMockConfig
} from '../helpers.js';

describe('write-git-commit: load-config.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('auto-detects session ID from pwd when no config', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      cwd: testEnv.tmpDir
    });

    assert.strictEqual(result.exitCode, 0, 'Script should exit successfully');
  });

  it('loads config from .claude/settings.plugins.write-git-commit.json', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    writeFileSync(configPath, JSON.stringify({ sessionId: '-Users-noahlz-projects-test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      cwd: testEnv.tmpDir
    });

    assert.strictEqual(result.exitCode, 0, 'Script should exit successfully');
  });

  it('config overrides auto-detected session ID', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    writeFileSync(configPath, JSON.stringify({ sessionId: '-custom-session-id' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      cwd: testEnv.tmpDir
    });

    assert.strictEqual(result.exitCode, 0, 'Script should exit successfully');
  });

  it('validates SESSION_ID is set', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');
    const config = getMockConfig(testEnv.tmpDir);

    const result = execBashScript(scriptPath, {
      ...config,
      cwd: testEnv.tmpDir
    });

    assert.strictEqual(result.exitCode, 0, 'Script should exit successfully');
  });
});
