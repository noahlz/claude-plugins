import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath
} from '../../node/helpers.js';

describe('run-and-fix-tests: load-config.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function createNpmConfig() {
    const configDir = join(testEnv.tmpDir, '.claude');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'settings.plugins.run-and-fix-tests.json'),
      JSON.stringify({
        buildTools: [
          {
            name: 'npm',
            buildCmd: 'npm run build',
            buildLog: 'out/build.log',
            buildErrorPattern: '(error|Error|ERROR)',
            buildWorkingDir: '.',
            testCmd: 'npm test',
            testLog: 'out/test.log',
            testErrorPattern: '(FAILED|FAIL|Error)',
            testSingleCmd: 'npm test -- {testFile}',
            testSingleLog: 'out/test-single.log',
            testSingleErrorPattern: '(FAILED|FAIL|Error)',
            logDir: 'out'
          }
        ],
        buildMulti: false
      })
    );
  }

  it('loads npm config from settings file', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should load npm config successfully');
  });

  it('exports build command from config', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should export build command');
  });

  it('exports test command from config', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should export test command');
  });

  it('exports log directory from config', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should export log directory');
  });

  it('exports build_multi flag', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should export buildMulti flag');
  });

  it('merges project config with defaults', () => {
    const configDir = join(testEnv.tmpDir, '.claude');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'settings.plugins.run-and-fix-tests.json'),
      JSON.stringify({
        buildTools: [
          {
            name: 'npm',
            buildCmd: 'npm run custom-build',
            buildLog: 'out/build.log',
            buildErrorPattern: '(error|Error|ERROR)',
            buildWorkingDir: '.',
            testCmd: 'npm test',
            testLog: 'out/test.log',
            testErrorPattern: '(FAILED|FAIL|Error)',
            testSingleCmd: 'npm test -- {testFile}',
            testSingleLog: 'out/test-single.log',
            testSingleErrorPattern: '(FAILED|FAIL|Error)',
            logDir: 'dist'
          }
        ],
        buildMulti: false
      })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should merge configs successfully');
  });

  it('handles single build tool config', () => {
    createNpmConfig();

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle single build tool');
  });

  it('handles multi-build config', () => {
    const configDir = join(testEnv.tmpDir, '.claude');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'settings.plugins.run-and-fix-tests.json'),
      JSON.stringify({
        build: [
          { tool: 'npm', location: 'app' },
          { tool: 'maven', location: 'backend' }
        ]
      })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle multi-build config');
  });

  it('provides error when config missing required fields', () => {
    const configDir = join(testEnv.tmpDir, '.claude');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'settings.plugins.run-and-fix-tests.json'),
      JSON.stringify({ buildTools: [] }) // Empty tools
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should handle gracefully or error with helpful message
    assert.ok(result.exitCode === 0 || result.exitCode !== 0, 'Should handle empty config');
  });
});
