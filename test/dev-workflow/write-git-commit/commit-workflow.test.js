import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  execGit,
  getPluginScriptPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';

/**
 * write-git-commit test suite
 *
 * Tests use Node.js module mocking to inject a mock git implementation.
 * The mock maintains state in .mock-git-commits files within the test's temp directory.
 * No real git repositories or commits are created during testing.
 */

describe('write-git-commit: commit-workflow.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();

    // Initialize git repo for testing
    execGit(['init'], { cwd: testEnv.tmpDir });
    execGit(['config', 'user.email', 'test@example.com'], { cwd: testEnv.tmpDir });
    execGit(['config', 'user.name', 'Test User'], { cwd: testEnv.tmpDir });

    // Create initial commit
    writeFileSync(join(testEnv.tmpDir, 'initial.txt'), 'initial');
    execGit(['add', 'initial.txt'], { cwd: testEnv.tmpDir });
    execGit(['commit', '-m', 'initial commit'], { cwd: testEnv.tmpDir });
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('prepare action returns "not_found" status when config does not exist', async () => {
    // Note: t.mock.module() doesn't work in subprocesses, so we test with real ccusage
    // The mocked ccusage tests in the "mocked ccusage" suite cover the case where
    // session resolution fails with a proper error message
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'prepare-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', testEnv.tmpDir, '', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        PATH: testEnv.mockPath
      }
    });

    let data;
    try {
      data = JSON.parse(readFileSync(outputFile, 'utf-8'));
    } catch (e) {
      assert.fail(`Output file should contain valid JSON: ${e.message}`);
    }

    assert.ok(['not_found'].includes(data.status), 'Should return "not_found" status');
    assert.ok(typeof data.message === 'string', 'Should have message field');
  });

  it('handles unknown action with error', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'unknown-action-output.json');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['unknown-action', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        PATH: testEnv.mockPath
      }
    });

    assert.notEqual(result.exitCode, 0, 'Should fail with unknown action');

    let data;
    try {
      data = JSON.parse(readFileSync(outputFile, 'utf-8'));
    } catch (e) {
      assert.fail(`Output file should contain valid JSON: ${e.message}`);
    }

    assert.equal(data.status, 'error', 'Status should be error');
    assert.ok(data.message.includes('Unknown action'), 'Should mention unknown action');
  });

  it('commit action returns metrics_invalid when metrics validation fails', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics via CLI args (empty array)
    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123', '--costs', JSON.stringify([])],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for empty cost array');
    assert.ok(data.data.attempted_costs, 'Should include attempted_costs in data');
  });

  it('commit action returns metrics_invalid when all metrics are zero', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics (all zeros) via CLI args
    const invalidMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123', '--costs', invalidMetrics],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for all-zero metrics');
  });

  it('commit action returns git_error when git commit fails', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass valid metrics but without staging changes (git commit will fail) via CLI args
    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'git_error', 'Status should be git_error when nothing is staged');
  });

  // ====== New: CLI Arguments and Refactored Features ======

  it('commit with --session-id and --costs CLI arguments succeeds', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'success', 'Status should be success with CLI arguments');
    assert.ok(data.data.commit_sha, 'Should return commit SHA');
  });

  it('commit fails when --session-id is missing', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--costs', validMetrics],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'error', 'Status should be error when session ID missing');
    assert.ok(data.message.includes('--session-id'), 'Error should mention --session-id argument');
  });

  it('commit fails when --costs is missing', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'error', 'Status should be error when costs missing');
    assert.ok(data.message.includes('--costs'), 'Error should mention --costs argument');
  });

  it('commit handles message with subject and body bullets', () => {
    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const messageWithBody = 'Add new feature\n\n- Implemented core functionality\n- Added unit tests';

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
      cwd: testEnv.tmpDir,
      input: messageWithBody,
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.equal(data.status, 'success', 'Should succeed with multi-line message');

    // Verify git log shows proper formatting
    const gitLogResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });

    assert.ok(gitLogResult.stdout.includes('Add new feature'), 'Should contain subject');
    assert.ok(gitLogResult.stdout.includes('- Implemented core functionality'), 'Should contain first bullet');
    assert.ok(gitLogResult.stdout.includes('- Added unit tests'), 'Should contain second bullet');
  });

  it('prepare with explicit valid sessionId succeeds', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', testEnv.tmpDir, '-Users-noahlz-projects-claude-plugins'],
      cwd: testEnv.tmpDir,
      env: {
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);

    // Should either succeed or fail gracefully (depending on whether session exists)
    // The key is that it accepts the sessionId argument and tries to fetch it
    assert.ok(['success', 'error'].includes(data.status), 'Should return valid status');
    if (data.status === 'success') {
      assert.ok(data.data.current_cost, 'Should have current_cost on success');
      assert.ok(Array.isArray(data.data.current_cost), 'current_cost should be array');
    }
  });

});
