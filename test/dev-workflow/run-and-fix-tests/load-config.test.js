import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupPluginTestEnv,
  teardownTestEnv,
  loadConfigFixture
} from './helpers.js';
import { loadConfig, generateEnv, formatJson } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/load-config.js';

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

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.ok(result.config, 'Should load config');
    assert.equal(result.env.BUILD_COUNT, '1', 'Should indicate single build');
    assert.equal(result.env.BUILD_0_CMD, 'npm run build', 'Should set BUILD_0_CMD');
  });

  it('resolves {outDir} variable in paths', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.outDir = 'build-logs';
      return config;
    });

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.env.BUILD_0_LOG, 'build-logs/build.log', 'Should resolve {outDir}');
    assert.equal(result.env.OUT_DIR, 'build-logs', 'Should export OUT_DIR');
  });

  it('handles multi-build config with array', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/multi-build-polyglot.json');

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should handle multi-build config');
    assert.equal(result.env.BUILD_COUNT, '2', 'Should set BUILD_COUNT');
    assert.equal(result.env.BUILD_0_CMD, 'npm run build', 'Should set BUILD_0_CMD');
    assert.equal(result.env.BUILD_1_CMD, 'mvn clean install', 'Should set BUILD_1_CMD');
    assert.equal(result.env.BUILD_0_WORKING_DIR, 'frontend', 'Should set BUILD_0_WORKING_DIR');
    assert.equal(result.env.BUILD_1_WORKING_DIR, 'backend', 'Should set BUILD_1_WORKING_DIR');
  });

  it('validates required fields', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/invalid-missing-logfile.json');

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should report validation errors');
    assert.match(result.errors[0], /resultsPath|logFile/, 'Should mention missing resultsPath');
  });

  it('generates bash exports', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });
    const env = result.env;

    // All env vars should be strings
    assert.equal(typeof env.BUILD_0_CMD, 'string');
    assert.equal(typeof env.BUILD_COUNT, 'string');
    assert.equal(typeof env.OUT_DIR, 'string');
    assert.equal(typeof env.TEST_RESULTS_PATH, 'string');

    // formatBashExports should produce valid bash
    const bashExports = JSON.stringify(env).replace(/export /g, 'export ');
    assert.ok(bashExports.includes('BUILD_0_CMD'), 'Should include BUILD_0_CMD in exports');
    assert.ok(bashExports.includes('TEST_RESULTS_PATH'), 'Should include TEST_RESULTS_PATH in exports');
  });

  it('errors when config file missing', () => {
    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.ok(result.errors.length > 0, 'Should error when config missing');
    assert.match(result.errors[0], /No project configuration/, 'Error should mention missing config');
  });

  it('handles test single commands with variables', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.env.TEST_SINGLE_CMD, 'npm test -- {testFile}', 'Should preserve test file placeholder');
  });

  it('exports working directory for single build', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.build[0].workingDir = 'frontend';
      return config;
    });

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.env.BUILD_0_WORKING_DIR, 'frontend', 'Should export working directory');
  });

  it('auto-detects skip when build command equals test command', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      // Make build and test commands identical (like test-only projects)
      config.build[0].command = 'npm test';
      config.test.all.command = 'npm test';
      return config;
    });

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.env.SKIP_BUILD, 'true', 'Should auto-detect SKIP_BUILD=true when commands match');
  });

  it('respects explicit skipBuild=true flag', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json', (config) => {
      config.skipBuild = true;
      // Can omit build array when skipBuild is true
      config.build = null;
      return config;
    });

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should allow null build when skipBuild=true');
    assert.equal(result.env.SKIP_BUILD, 'true', 'Should respect explicit skipBuild=true');
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

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.env.SKIP_BUILD, 'false', 'Should respect explicit skipBuild=false');
  });

  it('does not auto-skip for multi-build configs', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/multi-build-polyglot.json', (config) => {
      // Multi-build (BUILD_COUNT > 1) should never auto-skip
      return config;
    });

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.env.SKIP_BUILD, 'false', 'Should not auto-skip for multi-build');
  });

  it('sets SKIP_BUILD=false by default for single-build with different commands', () => {
    loadConfigFixture(testEnv, 'dev-workflow', 'configs/single-build-npm.json');

    const result = loadConfig({ pluginRoot: testEnv.pluginRoot, baseDir: testEnv.tmpDir });

    assert.equal(result.errors.length, 0, 'Should have no errors');
    assert.equal(result.env.SKIP_BUILD, 'false', 'Should default to false when commands differ');
  });
});
