import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupPluginTestEnv,
  teardownTestEnv,
  loadConfigFixture
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

  it('loads single-build npm config', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.ok(result.resolved, 'Should load config');
    assert.equal(result.resolved.build.length, 1, 'Should indicate single build');
    assert.equal(result.resolved.build[0].command, 'npm run build', 'Should set build command');
  });

  it('resolves {outDir} variable in paths', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.outDir = 'build-logs';
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.resolved.build[0].logFile, 'build-logs/build.log', 'Should resolve {outDir}');
    assert.equal(result.resolved.outDir, 'build-logs', 'Should preserve outDir');
  });

  it('handles multi-build config with array', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/multi-build-polyglot.json');

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should handle multi-build config');
    assert.equal(result.resolved.build.length, 2, 'Should have 2 builds');
    assert.equal(result.resolved.build[0].command, 'npm run build', 'Should set first build command');
    assert.equal(result.resolved.build[1].command, 'mvn clean install', 'Should set second build command');
    assert.equal(result.resolved.build[0].workingDir, 'frontend', 'Should set first working dir');
    assert.equal(result.resolved.build[1].workingDir, 'backend', 'Should set second working dir');
  });

  it('validates required fields', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/invalid-missing-logfile.json');

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should report validation errors');
    assert.match(result.errors[0], /resultsPath|logFile/, 'Should mention missing resultsPath');
  });

  it('errors when config file missing', () => {
    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should error when config missing');
    assert.match(result.errors[0], /No project configuration/, 'Error should mention missing config');
  });

  it('handles test single commands with variables', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.resolved.test.single.command, 'npm test -- {testFile}', 'Should preserve test file placeholder');
  });

  it('exports working directory for single build', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.build[0].workingDir = 'frontend';
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.resolved.build[0].workingDir, 'frontend', 'Should export working directory');
  });

  it('auto-detects skip when build command equals test command', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      // Make build and test commands identical (like test-only projects)
      config.build[0].command = 'npm test';
      config.test.all.command = 'npm test';
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.resolved.skipBuild, true, 'Should auto-detect skipBuild=true when commands match');
  });

  it('respects explicit skipBuild=true flag', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.skipBuild = true;
      // Can omit build array when skipBuild is true
      config.build = null;
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should allow null build when skipBuild=true');
    assert.equal(result.resolved.skipBuild, true, 'Should respect explicit skipBuild=true');
  });

  it('respects explicit skipBuild=false flag (no auto-skip)', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      // Set skipBuild explicitly to false to override auto-detection
      config.skipBuild = false;
      // Commands are still identical, but should not skip
      config.build[0].command = 'npm test';
      config.test.all.command = 'npm test';
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.resolved.skipBuild, false, 'Should respect explicit skipBuild=false');
  });

  it('does not auto-skip for multi-build configs', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/multi-build-polyglot.json', (config) => {
      // Multi-build (build.length > 1) should never auto-skip
      return config;
    });

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.resolved.skipBuild, false, 'Should not auto-skip for multi-build');
  });

  it('sets skipBuild=false by default for single-build with different commands', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.resolved.skipBuild, false, 'Should default to false when commands differ');
  });

  it('resolveConfig expands all paths', () => {
    const config = {
      outDir: 'build-logs',
      build: [{
        command: 'npm run build',
        logFile: '{outDir}/build.log',
        errorPattern: 'error',
        workingDir: 'frontend'
      }],
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

    assert.equal(resolved.build[0].logFile, 'build-logs/build.log', 'Should resolve build logFile');
    assert.equal(resolved.test.all.resultsPath, 'build-logs/test.log', 'Should resolve test resultsPath');
    assert.equal(resolved.test.single.resultsPath, 'build-logs/test-single.log', 'Should resolve single test resultsPath');
    assert.equal(resolved.logFile, 'build-logs/output.log', 'Should resolve logFile');
  });
});
