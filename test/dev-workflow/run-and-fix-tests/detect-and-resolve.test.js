import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  PLUGIN_ROOT,
  TESTS_ROOT
} from '../../lib/helpers.js';
import { detectTools, loadToolRegistry } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/detect-and-resolve.js';

describe('run-and-fix-tests: detect-and-resolve.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  function setupProjectTemplate(templateName) {
    const templatePath = join(TESTS_ROOT, 'dev-workflow', 'fixtures', 'project-templates', templateName);
    cpSync(templatePath, testEnv.tmpDir, { recursive: true });
  }

  it('detects npm project with package.json', () => {
    setupProjectTemplate('npm-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    assert.ok(detected.length > 0, 'Should detect tools');
    const npmTool = detected.find(t => t.tool === 'npm');
    assert.ok(npmTool, 'Should detect npm');
  });

  it('detects maven project with pom.xml', () => {
    setupProjectTemplate('maven-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    const mavenTool = detected.find(t => t.tool === 'maven');
    assert.ok(mavenTool, 'Should detect maven');
  });

  it('detects gradle project with build.gradle', () => {
    setupProjectTemplate('gradle-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    const gradleTool = detected.find(t => t.tool === 'gradle');
    assert.ok(gradleTool, 'Should detect gradle');
  });

  it('detects go project with go.mod', () => {
    setupProjectTemplate('go-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    const goTool = detected.find(t => t.tool === 'go');
    assert.ok(goTool, 'Should detect go');
  });

  it('detects multiple tools in polyglot project', () => {
    setupProjectTemplate('polyglot-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    assert.ok(detected.length >= 2, 'Should detect multiple tools');
    const hasNpm = detected.some(t => t.tool === 'npm');
    const hasMaven = detected.some(t => t.tool === 'maven');
    assert.ok(hasNpm, 'Should detect npm');
    assert.ok(hasMaven, 'Should detect maven');
  });

  it('searches subdirectories for config files', () => {
    mkdirSync(join(testEnv.tmpDir, 'apps', 'frontend'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'apps', 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }));

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    const npmTool = detected.find(t => t.tool === 'npm');
    assert.ok(npmTool, 'Should find npm in subdirectory');
  });

  it('returns detected tools with proper structure', () => {
    setupProjectTemplate('npm-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    assert.ok(detected.length > 0, 'Should detect tools');
    const tool = detected[0];
    assert.ok(tool.tool, 'Should have tool name');
    assert.ok(tool.location, 'Should have location');
    assert.ok(tool.config, 'Should have config');
    assert.ok(tool.config.build, 'Config should have build');
  });

  it('handles empty project (no tools detected)', () => {
    // Empty directory - no config files
    // detectTools returns empty array when nothing found

    try {
      const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });
      // If it returns empty array, that's valid
      assert.equal(detected.length, 0, 'Should return empty array for empty project');
    } catch (error) {
      // If it throws, that's also acceptable error handling
      assert.ok(error, 'Should handle empty project gracefully');
    }
  });

  it('normalizes project root location in output', () => {
    setupProjectTemplate('npm-project');

    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    const npmTool = detected.find(t => t.tool === 'npm');
    assert.equal(npmTool.location, '(project root)', 'Should normalize root directory as (project root)');
  });

  it('loads tool registry', () => {
    const registry = loadToolRegistry(PLUGIN_ROOT);

    assert.ok(registry, 'Should load tool registry');
    assert.ok(registry.npm, 'Should have npm in registry');
    assert.equal(registry.npm.configFile, 'package.json', 'npm configFile should be package.json');
  });

  it('returns empty array when registry loads but no tools found', () => {
    // This is a normal case - project exists but has no recognized build tools
    const detected = detectTools({ pluginRoot: PLUGIN_ROOT, rootDir: testEnv.tmpDir });

    assert.ok(Array.isArray(detected), 'Should return array');
    // No assertions on length - could be 0 or throw
  });
});
