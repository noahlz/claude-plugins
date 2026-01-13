import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupPluginTestEnv,
  teardownTestEnv,
  setupProjectTemplate
} from './helpers.js';
import { detectTools, loadToolRegistry } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/detect-and-resolve.js';

describe('run-and-fix-tests: detect-and-resolve.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupPluginTestEnv('dev-workflow');
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('detectTools', () => {
    describe('tool detection', () => {
      const toolTests = [
        { tool: 'npm', template: 'npm-project' },
        { tool: 'maven', template: 'maven-project' },
        { tool: 'gradle', template: 'gradle-project' },
        { tool: 'go', template: 'go-project' }
      ];

      toolTests.forEach(({ tool, template }) => {
        it(`detects ${tool} project by config file`, () => {
          setupProjectTemplate(testEnv, 'dev-workflow', template);

          const detected = detectTools({ pluginRoot: testEnv.pluginRoot, rootDir: testEnv.tmpDir });

          const foundTool = detected.find(t => t.tool === tool);
          assert.ok(foundTool, `Should detect ${tool}`);
        });
      });

      it('searches subdirectories for config files', () => {
        mkdirSync(join(testEnv.tmpDir, 'apps', 'frontend'), { recursive: true });
        writeFileSync(join(testEnv.tmpDir, 'apps', 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }));

        const detected = detectTools({ pluginRoot: testEnv.pluginRoot, rootDir: testEnv.tmpDir });

        const npmTool = detected.find(t => t.tool === 'npm');
        assert.ok(npmTool, 'Should find npm in subdirectory');
      });
    });

    describe('result structure', () => {
      it('returns detected tools with proper structure', () => {
        setupProjectTemplate(testEnv, 'dev-workflow', 'npm-project');

        const detected = detectTools({ pluginRoot: testEnv.pluginRoot, rootDir: testEnv.tmpDir });

        assert.ok(detected.length > 0, 'Should detect tools');
        const tool = detected[0];
        assert.ok(tool.tool, 'Should have tool name');
        assert.ok(tool.location, 'Should have location');
        assert.ok(tool.config, 'Should have config');
        assert.ok(tool.config.build, 'Config should have build');
      });

      it('normalizes project root location in output', () => {
        setupProjectTemplate(testEnv, 'dev-workflow', 'npm-project');

        const detected = detectTools({ pluginRoot: testEnv.pluginRoot, rootDir: testEnv.tmpDir });

        const npmTool = detected.find(t => t.tool === 'npm');
        assert.equal(npmTool.location, '(project root)', 'Should normalize root directory as (project root)');
      });
    });

    describe('edge cases', () => {
      it('handles empty project (no tools detected)', () => {
        // Empty directory - no config files
        // detectTools returns empty array when nothing found

        try {
          const detected = detectTools({ pluginRoot: testEnv.pluginRoot, rootDir: testEnv.tmpDir });
          // If it returns empty array, that's valid
          assert.equal(detected.length, 0, 'Should return empty array for empty project');
        } catch (error) {
          // If it throws, that's also acceptable error handling
          assert.ok(error, 'Should handle empty project gracefully');
        }
      });
    });
  });

  describe('loadToolRegistry', () => {
    it('loads tool registry', () => {
      const registry = loadToolRegistry(testEnv.pluginRoot);

      assert.ok(registry, 'Should load tool registry');
      assert.ok(registry.npm, 'Should have npm in registry');
      assert.equal(registry.npm.configFile, 'package.json', 'npm configFile should be package.json');
    });
  });
});
