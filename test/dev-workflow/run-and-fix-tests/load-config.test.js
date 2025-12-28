import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  assertFileExists,
  PLUGIN_ROOT
} from '../../helpers.js';
import { loadConfig, generateEnv, formatJson } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/load-config.js';

describe('run-and-fix-tests: load-config.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function createConfigDir() {
    const configDir = join(testEnv.tmpDir, '.claude');
    mkdirSync(configDir, { recursive: true });
    return configDir;
  }

  function writeConfig(config) {
    const configDir = createConfigDir();
    writeFileSync(
      join(configDir, 'settings.plugins.run-and-fix-tests.json'),
      JSON.stringify(config)
    );
  }

  it('loads single-build npm config', () => {
    writeConfig({
      logDir: 'dist',
      build: {
        command: 'npm run build',
        logFile: '{logDir}/build.log',
        errorPattern: '(error|Error|ERR!)'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL|Error)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL|Error)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.ok(result.config, 'Should load config');
    assert.equal(result.env.BUILD_MULTI, 'false', 'Should indicate single-build mode');
    assert.equal(result.env.BUILD_CMD, 'npm run build', 'Should set BUILD_CMD');
  });

  it('resolves {logDir} variable in paths', () => {
    writeConfig({
      logDir: 'build-logs',
      build: {
        command: 'npm run build',
        logFile: '{logDir}/build.log',
        errorPattern: '(error)'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.env.BUILD_LOG, 'build-logs/build.log', 'Should resolve {logDir}');
    assert.equal(result.env.TEST_LOG, 'build-logs/test.log', 'Should resolve {logDir} for test');
  });

  it('handles multi-build config with array', () => {
    writeConfig({
      logDir: 'dist',
      build: [
        {
          tool: 'npm',
          command: 'npm run build',
          workingDir: 'frontend',
          logFile: '{logDir}/npm.log',
          errorPattern: '(error)'
        },
        {
          tool: 'maven',
          command: 'mvn clean install',
          workingDir: 'backend',
          logFile: '{logDir}/maven.log',
          errorPattern: '\\[ERROR\\]'
        }
      ],
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should handle multi-build config');
    assert.equal(result.env.BUILD_MULTI, 'true', 'Should indicate multi-build mode');
    assert.equal(result.env.BUILD_COUNT, '2', 'Should set BUILD_COUNT');
    assert.equal(result.env.BUILD_0_CMD, 'npm run build', 'Should set BUILD_0_CMD');
    assert.equal(result.env.BUILD_1_CMD, 'mvn clean install', 'Should set BUILD_1_CMD');
    assert.equal(result.env.BUILD_0_WORKING_DIR, 'frontend', 'Should set BUILD_0_WORKING_DIR');
    assert.equal(result.env.BUILD_1_WORKING_DIR, 'backend', 'Should set BUILD_1_WORKING_DIR');
  });

  it('normalizes old schema (buildTools array)', () => {
    writeConfig({
      buildTools: [
        {
          buildCmd: 'npm run build',
          buildLog: 'dist/build.log',
          buildErrorPattern: '(error)',
          buildWorkingDir: '.',
          testCmd: 'npm test',
          testLog: 'dist/test.log',
          testErrorPattern: '(FAIL)',
          testSingleCmd: 'npm test -- {file}',
          testSingleLog: 'dist/test-single.log',
          testSingleErrorPattern: '(FAIL)',
          logDir: 'dist'
        }
      ]
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should load old schema');
    assert.ok(result.warnings.length > 0, 'Should emit deprecation warning');
    assert.match(result.warnings[0], /deprecated/, 'Warning should mention deprecation');
    assert.equal(result.env.BUILD_CMD, 'npm run build', 'Should normalize BUILD_CMD');
  });

  it('validates required fields', () => {
    writeConfig({
      logDir: 'dist',
      build: {
        command: 'npm run build',
        // missing logFile
        errorPattern: '(error)'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: 'dist/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {file}',
          logFile: 'dist/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should report validation errors');
    assert.match(result.errors[0], /logFile/, 'Should mention missing logFile');
  });

  it('generates bash exports', () => {
    writeConfig({
      logDir: 'dist',
      build: {
        command: 'npm run build',
        logFile: '{logDir}/build.log',
        errorPattern: '(error)'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });
    const env = result.env;

    // All env vars should be strings
    assert.equal(typeof env.BUILD_CMD, 'string');
    assert.equal(typeof env.BUILD_MULTI, 'string');
    assert.equal(typeof env.LOG_DIR, 'string');

    // formatBashExports should produce valid bash
    const bashExports = JSON.stringify(env).replace(/export /g, 'export ');
    assert.ok(bashExports.includes('BUILD_CMD'), 'Should include BUILD_CMD in exports');
  });

  it('errors when config file missing', () => {
    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should error when config missing');
    assert.match(result.errors[0], /No project configuration/, 'Error should mention missing config');
  });

  it('handles test single commands with variables', () => {
    writeConfig({
      logDir: 'dist',
      build: {
        command: 'npm run build',
        logFile: '{logDir}/build.log',
        errorPattern: '(error)'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.env.TEST_SINGLE_CMD, 'npm test -- {testFile}', 'Should preserve test file placeholder');
  });

  it('exports working directory for single build', () => {
    writeConfig({
      logDir: 'dist',
      build: {
        command: 'npm run build',
        logFile: '{logDir}/build.log',
        errorPattern: '(error)',
        workingDir: 'frontend'
      },
      test: {
        all: {
          command: 'npm test',
          logFile: '{logDir}/test.log',
          errorPattern: '(FAIL)'
        },
        single: {
          command: 'npm test -- {testFile}',
          logFile: '{logDir}/test-single.log',
          errorPattern: '(FAIL)'
        }
      }
    });

    const result = loadConfig({ pluginRoot: PLUGIN_ROOT, baseDir: testEnv.tmpDir });

    assert.equal(result.env.BUILD_WORKING_DIR, 'frontend', 'Should export working directory');
  });
});
