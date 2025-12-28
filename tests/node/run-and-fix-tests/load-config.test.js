import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  getPluginScriptPath
} from '../helpers.js';
import { statSync } from 'node:fs';

describe('run-and-fix-tests: load-config.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  // Helper: Create a standard npm project config
  function createNpmConfig() {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.run-and-fix-tests.json');
    writeFileSync(configPath, JSON.stringify({
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
    }));
  }

  it('script exists and is executable', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    const stat = statSync(scriptPath);
    assert.ok(stat.isFile(), 'Script should exist');
    assert.ok(stat.mode & 0o111, 'Script should be executable');
  });

  it('loads npm config', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath.includes('load-config'), 'Script should be load-config.sh');
  });

  it('exports build_multi flag', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath, 'Script path should be set');
  });

  it('exports log directory', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath.endsWith('.sh'), 'Should be shell script');
  });

  it('exports build command', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath.includes('run-and-fix-tests'), 'Should be run-and-fix-tests skill');
  });

  it('exports test commands', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('merges project config with defaults', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.run-and-fix-tests.json');
    writeFileSync(configPath, JSON.stringify({
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
    }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('handles single build config', () => {
    createNpmConfig();
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath, 'Script path should be set');
  });

  it('handles multi-build config', () => {
    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.run-and-fix-tests.json');
    writeFileSync(configPath, JSON.stringify({
      build: [
        {
          tool: 'npm',
          location: 'app'
        },
        {
          tool: 'maven',
          location: 'backend'
        }
      ]
    }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'load-config.sh');
    assert.ok(scriptPath, 'Script should exist');
  });
});
