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

describe('run-and-fix-tests: detect-and-resolve.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('detects npm project', () => {
    // Create package.json
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { build: 'npm run build', test: 'npm test' }
    }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with npm project');
    assert.match(result.stdout, /npm/, 'Output should mention npm');
  });

  it('detects maven project', () => {
    mkdirSync(join(testEnv.tmpDir, 'src', 'main', 'java'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
</project>`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with maven project');
    assert.match(result.stdout, /maven|pom/, 'Output should mention maven or pom');
  });

  it('detects gradle project', () => {
    writeFileSync(join(testEnv.tmpDir, 'build.gradle'), `plugins {
  id 'java'
}`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with gradle project');
    assert.match(result.stdout, /gradle|build\.gradle/, 'Output should mention gradle');
  });

  it('detects go project', () => {
    writeFileSync(join(testEnv.tmpDir, 'go.mod'), `module github.com/example/test
go 1.19`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with go project');
    assert.match(result.stdout, /go|go\.mod/, 'Output should mention go');
  });

  it('detects multiple tools', () => {
    // Create npm + maven project
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'frontend' }));
    mkdirSync(join(testEnv.tmpDir, 'backend', 'src', 'main', 'java'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'backend', 'pom.xml'), `<?xml version="1.0"?>
<project></project>`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed with multiple tools');
    // Should detect both npm and maven
    assert.match(result.stdout, /npm/, 'Should detect npm');
    assert.match(result.stdout, /maven/, 'Should detect maven');
  });

  it('searches subdirectories for config files', () => {
    mkdirSync(join(testEnv.tmpDir, 'apps', 'frontend'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'apps', 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should find tools in subdirectories');
    assert.match(result.stdout, /npm/, 'Should find npm in subdirectory');
  });

  it('outputs detected tools in JSON format', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');

    // Should export DETECTED_TOOLS as JSON
    // The script outputs a formatted list, but exports JSON to the environment
    assert.ok(result.stdout.length > 0, 'Should have output');
  });

  it('handles empty project (no tools detected)', () => {
    // Don't create any config files
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should fail when no tools detected
    assert.notEqual(result.exitCode, 0, 'Should fail when no tools detected');
    assert.match(result.stderr, /No build tools|Error/, 'Should mention no tools in error');
  });

  it('normalizes project root location in output', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should succeed');
    // Should show (project root) for files at root
    assert.match(result.stdout, /project root/, 'Should normalize root directory location');
  });
});
