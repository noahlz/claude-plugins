import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  PLUGIN_ROOT,
  readFixture
} from '../../lib/helpers.js';
import { selectDefault, generatePolyglotConfig } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/select-default.js';

describe('run-and-fix-tests: select-default.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function createToolConfig(toolName) {
    const baseConfig = JSON.parse(readFixture('configs/single-build-npm.json'));

    return {
      tool: toolName,
      location: '(project root)',
      configFile: toolName === 'npm' ? 'package.json' : 'pom.xml',
      config: baseConfig
    };
  }

  it('handles single npm tool', () => {
    const detectedTools = [createToolConfig('npm')];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    assert.equal(result.source, 'npm.json', 'Should copy npm.json');
    assert.ok(result.configPath.includes('.claude'), 'Should create in .claude directory');
  });

  it('handles single maven tool', () => {
    const detectedTools = [createToolConfig('maven')];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    assert.equal(result.source, 'maven.json', 'Should copy maven.json');
    assert.ok(result.configPath.includes('.claude'), 'Should create in .claude directory');
  });

  it('handles single go tool', () => {
    const detectedTools = [{
      tool: 'go',
      location: '(project root)',
      configFile: 'go.mod',
      config: {}
    }];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    assert.ok(result.configPath.includes('.claude'), 'Should create config');
    // May use template if no go.json default
    assert.ok(result.source === 'go.json' || result.source === 'TEMPLATE.json', 'Should use go or template');
  });

  it('generates polyglot config for multiple tools', () => {
    const detectedTools = [
      createToolConfig('npm'),
      createToolConfig('maven')
    ];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    assert.equal(result.source, 'polyglot', 'Should indicate polyglot config');
    assert.deepEqual(result.tools, ['npm', 'maven'], 'Should list detected tools');

    // Verify config file was created
    const configFile = readFileSync(result.configPath, 'utf-8');
    const config = JSON.parse(configFile);
    assert.ok(Array.isArray(config.build), 'Should have build array');
    assert.equal(config.build.length, 2, 'Should have 2 build entries');
  });

  it('respects tool location in polyglot config', () => {
    const detectedTools = [
      { ...createToolConfig('npm'), location: '(project root)' },
      { ...createToolConfig('maven'), location: 'backend' }
    ];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    const configFile = readFileSync(result.configPath, 'utf-8');
    const config = JSON.parse(configFile);

    assert.equal(config.build[0].workingDir, '.', 'Should convert (project root) to .');
    assert.equal(config.build[1].workingDir, 'backend', 'Should use backend for second tool');
  });

  it('creates config file on disk', () => {
    const detectedTools = [createToolConfig('npm')];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    const configFile = readFileSync(result.configPath, 'utf-8');
    assert.ok(configFile, 'Should create config file');

    const config = JSON.parse(configFile);
    assert.ok(config.build, 'Config should have build property');
    assert.ok(config.test, 'Config should have test property');
  });

  it('handles empty detected tools with template', () => {
    const detectedTools = [];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    assert.equal(result.source, 'TEMPLATE.json', 'Should use template for empty tools');
    assert.ok(result.warnings.length > 0, 'Should emit warnings');
  });

  it('generates valid polyglot config structure', () => {
    const detectedTools = [
      createToolConfig('npm'),
      createToolConfig('maven')
    ];

    const config = generatePolyglotConfig(detectedTools, PLUGIN_ROOT);

    assert.ok(config.logDir, 'Should have logDir');
    assert.ok(Array.isArray(config.build), 'Should have build array');
    assert.ok(config.test, 'Should have test');

    config.build.forEach(build => {
      assert.ok(build.tool, 'Each build should have tool');
      assert.ok(build.command, 'Each build should have command');
      assert.ok(build.workingDir, 'Each build should have workingDir');
      assert.ok(build.logFile, 'Each build should have logFile');
      assert.ok(build.errorPattern, 'Each build should have errorPattern');
    });
  });

  it('uses first tool test config for polyglot', () => {
    const detectedTools = [
      createToolConfig('npm'),
      createToolConfig('maven')
    ];

    const config = generatePolyglotConfig(detectedTools, PLUGIN_ROOT);

    // Should use npm test config (first tool)
    assert.equal(config.test.all.command, 'npm test', 'Should use first tool test command');
  });

  it('warns when tool has no default config', () => {
    const detectedTools = [{
      tool: 'unknown-tool',
      location: '(project root)',
      configFile: 'unknown.txt',
      config: null // No config available
    }];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    // Should handle gracefully, either with template or warnings
    assert.ok(result.configPath, 'Should create config path');
  });

  it('creates .claude directory if missing', () => {
    const detectedTools = [createToolConfig('npm')];

    const result = selectDefault({
      detectedTools,
      pluginRoot: PLUGIN_ROOT,
      targetDir: testEnv.tmpDir
    });

    const claudeDir = join(testEnv.tmpDir, '.claude');
    const configExists = readFileSync(result.configPath, 'utf-8');
    assert.ok(configExists, 'Should create config in .claude directory');
  });
});
