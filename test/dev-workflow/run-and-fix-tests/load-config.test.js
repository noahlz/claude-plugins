import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupPluginTestEnv,
  teardownTestEnv,
  loadConfigFixture,
  loadAndAssertConfig,
  assertNoConfigErrors,
  assertConfigError
} from './helpers.js';
import { loadConfig, resolveConfig } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/load-config.js';

describe('run-and-fix-tests: load-config.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupPluginTestEnv('dev-workflow');
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('loadConfig', () => {
    describe('basic loading', () => {
      it('loads single-build npm config', () => {
        const result = loadAndAssertConfig(
          testEnv,
          'configs/single-build-npm.json',
          null,
          assertNoConfigErrors
        );

        assert.equal(result.resolved.build.command, 'npm run build', 'Should set build command');
      });

      it('errors when config file missing', () => {
        const result = loadConfig({ baseDir: testEnv.tmpDir });

        assertConfigError(result, /No project configuration/);
      });
    });

    describe('variable resolution', () => {
      it('resolves {outDir} variable in paths', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json', (config) => {
          config.outDir = 'build-logs';
          return config;
        });

        const result = loadConfig({ baseDir: testEnv.tmpDir });

        assert.equal(result.resolved.build.logFile, 'build-logs/build.log', 'Should resolve {outDir}');
        assert.equal(result.resolved.outDir, 'build-logs', 'Should preserve outDir');
      });

      it('handles test single commands with variables', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json');

        const result = loadConfig({ baseDir: testEnv.tmpDir });

        assert.equal(result.resolved.test.single.command, 'npm test -- {testFile}', 'Should preserve test file placeholder');
      });
    });

    describe('working directory', () => {
      it('exports working directory for single build', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json', (config) => {
          config.build.workingDir = 'frontend';
          return config;
        });

        const result = loadConfig({ baseDir: testEnv.tmpDir });

        assert.equal(result.resolved.build.workingDir, 'frontend', 'Should export working directory');
      });
    });

    describe('skipBuild behavior', () => {
      it('auto-detects skip when build command equals test command', () => {
        const result = loadAndAssertConfig(
          testEnv,
          'configs/single-build-npm.json',
          (config) => {
            // Make build and test commands identical (like test-only projects)
            config.build.command = 'npm test';
            config.test.all.command = 'npm test';
            return config;
          },
          assertNoConfigErrors
        );

        assert.equal(result.resolved.skipBuild, true, 'Should auto-detect skipBuild=true when commands match');
      });

      it('respects explicit skipBuild=true flag', () => {
        const result = loadAndAssertConfig(
          testEnv,
          'configs/single-build-npm.json',
          (config) => {
            config.skipBuild = true;
            // Can omit build array when skipBuild is true
            config.build = null;
            return config;
          },
          assertNoConfigErrors
        );

        assert.equal(result.resolved.skipBuild, true, 'Should respect explicit skipBuild=true');
      });

      it('respects explicit skipBuild=false flag (no auto-skip)', () => {
        const result = loadAndAssertConfig(
          testEnv,
          'configs/single-build-npm.json',
          (config) => {
            // Set skipBuild explicitly to false to override auto-detection
            config.skipBuild = false;
            // Commands are still identical, but should not skip
            config.build.command = 'npm test';
            config.test.all.command = 'npm test';
            return config;
          },
          assertNoConfigErrors
        );

        assert.equal(result.resolved.skipBuild, false, 'Should respect explicit skipBuild=false');
      });

      it('sets skipBuild=false by default for single-build with different commands', () => {
        const result = loadAndAssertConfig(
          testEnv,
          'configs/single-build-npm.json',
          null,
          assertNoConfigErrors
        );

        assert.equal(result.resolved.skipBuild, false, 'Should default to false when commands differ');
      });
    });

    describe('validation', () => {
      it('validates required fields', () => {
        loadConfigFixture(testEnv, 'configs/invalid-missing-logfile.json');
        const result = loadConfig({ baseDir: testEnv.tmpDir });

        assertConfigError(result, /resultsPath|logFile/);
      });

      it('errors when config is null', () => {
        // Manually call loadConfig with a baseDir that has no config
        // This simulates a null config scenario
        const result = loadConfig({ baseDir: '/nonexistent/path' });

        assertConfigError(result, /No project configuration|Config is null or undefined/);
      });

      it('errors when test.all is missing', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json', (config) => {
          delete config.test.all;
          return config;
        });

        const result = loadConfig({ baseDir: testEnv.tmpDir });
        assertConfigError(result, /test.all is required/);
      });

      it('errors when test.single is missing', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json', (config) => {
          delete config.test.single;
          return config;
        });

        const result = loadConfig({ baseDir: testEnv.tmpDir });
        assertConfigError(result, /test.single is required/);
      });

      it('errors when build is missing and skipBuild is not true', () => {
        loadConfigFixture(testEnv, 'configs/single-build-npm.json', (config) => {
          delete config.build;
          // skipBuild is undefined/false, so build is required
          return config;
        });

        const result = loadConfig({ baseDir: testEnv.tmpDir });
        assertConfigError(result, /build.*property.*skipBuild/);
      });
    });
  });

  describe('resolveConfig', () => {
    it('expands all paths', () => {
      const config = {
        outDir: 'build-logs',
        build: {
          command: 'npm run build',
          logFile: '{outDir}/build.log',
          errorPattern: 'error',
          workingDir: 'frontend'
        },
        test: {
          all: {
            command: 'npm test',
            resultsPath: '{outDir}/test.log',
            errorPattern: 'FAIL'
          },
          single: {
            command: 'npm test -- {testFile}',
            resultsPath: '{outDir}/test-single.log',
            errorPattern: 'FAIL'
          }
        },
        logFile: '{outDir}/output.log'
      };

      const resolved = resolveConfig(config);

      assert.equal(resolved.build.logFile, 'build-logs/build.log', 'Should resolve build logFile');
      assert.equal(resolved.test.all.resultsPath, 'build-logs/test.log', 'Should resolve test resultsPath');
      assert.equal(resolved.test.single.resultsPath, 'build-logs/test-single.log', 'Should resolve single test resultsPath');
      assert.equal(resolved.logFile, 'build-logs/output.log', 'Should resolve logFile');
    });
  });
});
