import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  getPluginScriptPath,
  readFixture
} from '../../lib/helpers.js';

describe('write-git-commit: load-config.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function loadConfigFixture(sessionId) {
    const fixtureData = readFixture('dev-workflow', 'configs/write-git-commit-settings.json');
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
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with auto-detected session');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'success', 'Status should be success');
    assert.ok(data.data.sessionId, 'Should have session ID');
    assert.equal(data.data.autoDetected, true, 'Should be auto-detected');
  });

  it('loads sessionId from config file when it exists', () => {
    loadConfigFixture('test-session-123');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed loading from config');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'success', 'Status should be success');
    assert.equal(data.data.sessionId, 'test-session-123', 'Should load correct session ID');
    assert.equal(data.data.configExists, true, 'Config should be marked as existing');
    assert.equal(data.data.autoDetected, false, 'Should not be auto-detected');
  });

  it('indicates config exists when file is present', () => {
    loadConfigFixture('test-session');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.data.configExists, true, 'Config should exist');
  });

  it('indicates auto-detection when no config file exists', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with auto-detection');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.data.autoDetected, true, 'Should indicate auto-detection');
  });

  it('returns converted session ID in auto-detect mode', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    // Auto-detected session ID should use dash format (/ -> -)
    assert.ok(data.data.sessionId.includes('-'), 'Session ID should contain dashes from path conversion');
  });

  it('errors when config file is missing sessionId field', () => {
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({}) // No sessionId field
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail without sessionId in config');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.status, 'error', 'Status should be error');
    assert.ok(data.message.includes('sessionId'), 'Should mention sessionId in error');
  });

  it('prefers config file over auto-detection', () => {
    loadConfigFixture('configured-session');

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'load-config.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should load from config');

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Output should be valid JSON: ${result.stdout}`);
    }

    assert.equal(data.data.sessionId, 'configured-session', 'Should use configured session ID');
    assert.equal(data.data.configExists, true, 'Config should exist');
  });

});
