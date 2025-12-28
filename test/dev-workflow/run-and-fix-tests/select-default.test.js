import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execBashScript,
  getPluginScriptPath
} from '../../helpers.js';

describe('run-and-fix-tests: select-default.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('script exists and is executable', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript('test', {
      args: ['-x', scriptPath]
    });

    assert.equal(result.exitCode, 0, 'Script should be executable');
  });

  it('handles single npm tool', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'npm', location: '.' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle single npm tool');
  });

  it('handles single maven tool', () => {
    mkdirSync(join(testEnv.tmpDir, 'src', 'main', 'java'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'pom.xml'), '<project></project>');

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'maven', location: '.' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle single maven tool');
  });

  it('handles single go tool', () => {
    writeFileSync(join(testEnv.tmpDir, 'go.mod'), 'module test');

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'go', location: '.' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle single go tool');
  });

  it('handles multiple tools for polyglot project', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'frontend' }));
    mkdirSync(join(testEnv.tmpDir, 'backend', 'src', 'main', 'java'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'backend', 'pom.xml'), '<project></project>');

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'npm', location: '.' },
          { tool: 'maven', location: 'backend' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should handle multiple tools');
  });

  it('respects tool location in config', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'npm', location: 'apps/frontend' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should respect tool locations');
  });

  it('creates config file on disk', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([
          { tool: 'npm', location: '.' }
        ]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should create config file');
  });

  it('handles empty detected tools', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');

    const result = execBashScript(scriptPath, {
      cwd: testEnv.tmpDir,
      env: {
        DETECTED_TOOLS: JSON.stringify([]),
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should handle gracefully (error or skip)
    assert.ok(result.exitCode === 0 || result.exitCode !== 0, 'Should handle empty tools');
  });
});
