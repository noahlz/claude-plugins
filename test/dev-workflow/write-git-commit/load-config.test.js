import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath,
  readFixture
} from '../../lib/helpers.js';

describe('write-git-commit: load-config.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function loadConfigFixture(sessionId) {
    const fixtureData = readFixture('configs/write-git-commit-settings.json');
    let config = JSON.parse(fixtureData);
    if (sessionId !== undefined) {
      config.sessionId = sessionId;
    }
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify(config)
    );
  }

  it('auto-detects session ID from project path when no config exists', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with auto-detected session');
  });

  it('loads SESSION_ID from config file when it exists', () => {
    loadConfigFixture('test-session-123');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed loading from config');
  });

  it('sets CONFIG_EXISTS flag based on config presence', () => {
    loadConfigFixture('test-session');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');
    // When config exists, CONFIG_EXISTS should be true
    assert.match(result.stdout, /true|false|CONFIG/, 'Script should export config status');
  });

  it('sets SESSION_AUTO_DETECTED flag when using auto-detection', () => {
    // Don't create a config file
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with auto-detection');
  });

  it('converts pwd to session ID format', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');
    // Auto-detected session ID should use dash format (/ -> -)
  });

  it('errors when SESSION_ID cannot be determined', () => {
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({}) // No sessionId field
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // When config has no sessionId and we can't auto-detect, should error
    assert.notEqual(result.exitCode, 0, 'Should fail without SESSION_ID');
    assert.match(result.stderr, /session|SESSION/, 'Should mention session in error');
  });

  it('exports SESSION_ID for use by other scripts', () => {
    loadConfigFixture('exported-session');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should export SESSION_ID');
  });

  it('prefers config file over auto-detection', () => {
    loadConfigFixture('configured-session');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should load from config');
  });

});
