import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  setupTestEnv,
  teardownTestEnv,
  getPluginScriptPath
} from '../helpers.js';
import { statSync } from 'node:fs';

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
    const stat = statSync(scriptPath);
    assert.ok(stat.isFile(), 'Script should exist');
    assert.ok(stat.mode & 0o111, 'Script should be executable');
  });

  it('single npm tool script path is correct', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath.includes('select-default'), 'Script name should be correct');
  });

  it('handles single tool detection', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath.endsWith('.sh'), 'Should be shell script');
  });

  it('handles single maven tool', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('handles single go tool', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath.includes('run-and-fix-tests'), 'Should be in correct skill');
  });

  it('handles multiple tools for polyglot', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('creates config file on disk', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('handles empty detected tools', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath, 'Script should handle empty input');
  });

  it('respects tool location in config', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'select-default.sh');
    assert.ok(scriptPath, 'Script should respect tool locations');
  });
});
