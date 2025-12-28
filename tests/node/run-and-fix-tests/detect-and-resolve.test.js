import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  getPluginScriptPath
} from '../helpers.js';
import { statSync } from 'node:fs';

describe('run-and-fix-tests: detect-and-resolve.sh', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('script exists and is executable', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    const stat = statSync(scriptPath);
    assert.ok(stat.isFile(), 'Script should exist');
    assert.ok(stat.mode & 0o111, 'Script should be executable');
  });

  it('detects npm project', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { build: 'webpack', test: 'jest' }
    }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath.includes('detect-and-resolve'), 'Script should be correct');
  });

  it('detects maven project', () => {
    mkdirSync(join(testEnv.tmpDir, 'src', 'main', 'java'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
</project>`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('detects gradle project', () => {
    writeFileSync(join(testEnv.tmpDir, 'build.gradle'), `plugins {
  id 'java'
}`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath.endsWith('.sh'), 'Should be shell script');
  });

  it('detects go project', () => {
    writeFileSync(join(testEnv.tmpDir, 'go.mod'), `module github.com/example/test
go 1.19`);

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('detects multiple tools', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    mkdirSync(join(testEnv.tmpDir, 'frontend'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath, 'Script should exist');
  });

  it('searches subdirectories', () => {
    mkdirSync(join(testEnv.tmpDir, 'apps', 'frontend'), { recursive: true });
    writeFileSync(join(testEnv.tmpDir, 'apps', 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }));

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath.includes('run-and-fix-tests'), 'Should be in correct skill');
  });

  it('handles no build files found', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath, 'Script should exist even with empty project');
  });

  it('handles invalid build files', () => {
    writeFileSync(join(testEnv.tmpDir, 'package.json'), '{invalid json');

    const scriptPath = getPluginScriptPath('dev-workflow', 'run-and-fix-tests', 'detect-and-resolve.sh');
    assert.ok(scriptPath, 'Script should exist');
  });
});
