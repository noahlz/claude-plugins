import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupPluginTestEnv,
  teardownTestEnv,
  createToolConfig
} from './helpers.js';
import { readJsonFile } from '../../lib/helpers.js';
import { selectDefault } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/select-default.js';

describe('run-and-fix-tests: select-default.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupPluginTestEnv('dev-workflow');
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('tool selection', () => {
    it('handles single npm tool', () => {
      const detectedTools = [createToolConfig('npm')];

      const result = selectDefault({
        detectedTools,
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      assert.equal(result.source, 'npm.json', 'Should copy npm.json');
      assert.ok(result.configPath.includes('.claude'), 'Should create in .claude directory');
    });

    it('handles single maven tool', () => {
      const detectedTools = [createToolConfig('maven')];

      const result = selectDefault({
        detectedTools,
        pluginRoot: testEnv.pluginRoot,
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
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      assert.ok(result.configPath.includes('.claude'), 'Should create config');
      // May use template if no go.json default
      assert.ok(result.source === 'go.json' || result.source === 'TEMPLATE.json', 'Should use go or template');
    });
  });

  describe('file creation', () => {
    it('creates config file on disk', () => {
      const detectedTools = [createToolConfig('npm')];

      const result = selectDefault({
        detectedTools,
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      const config = readJsonFile(result.configPath);
      assert.ok(config, 'Should create config file');
      assert.ok(config.build || config.skipBuild, 'Config should have build or skipBuild property');
      assert.ok(config.test, 'Config should have test property');
    });

    it('creates .claude directory if missing', () => {
      const detectedTools = [createToolConfig('npm')];

      const result = selectDefault({
        detectedTools,
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      const config = readJsonFile(result.configPath);
      assert.ok(config, 'Should create config in .claude directory');
    });
  });

  describe('edge cases', () => {
    it('handles empty detected tools with template', () => {
      const detectedTools = [];

      const result = selectDefault({
        detectedTools,
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      assert.equal(result.source, 'TEMPLATE.json', 'Should use template for empty tools');
      assert.ok(result.warnings.length > 0, 'Should emit warnings');
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
        pluginRoot: testEnv.pluginRoot,
        targetDir: testEnv.tmpDir
      });

      // Should handle gracefully, either with template or warnings
      assert.ok(result.configPath, 'Should create config path');
    });

    it('throws error for polyglot projects (2+ tools)', () => {
      const detectedTools = [
        createToolConfig('npm'),
        createToolConfig('maven')
      ];

      assert.throws(() => {
        selectDefault({
          detectedTools,
          pluginRoot: testEnv.pluginRoot,
          targetDir: testEnv.tmpDir
        });
      }, /Polyglot projects not yet supported/);
    });

    it('throws error when template file is missing', () => {
      const detectedTools = [];

      assert.throws(() => {
        selectDefault({
          detectedTools,
          pluginRoot: '/nonexistent/path', // Invalid plugin root
          targetDir: testEnv.tmpDir
        });
      }, /Template not found/);
    });
  });
});
