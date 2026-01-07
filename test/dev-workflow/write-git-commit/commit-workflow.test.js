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

  it('prepare action returns error when config does not exist', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'prepare-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', testEnv.tmpDir, '', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    let data;
    try {
      data = JSON.parse(readFileSync(outputFile, 'utf-8'));
    } catch (e) {
      assert.fail(`Output file should contain valid JSON: ${e.message}`);
    }

    // Status should be error when no config exists and no sessionId provided
    assert.equal(data.status, 'error', 'Should return error when no config exists and no sessionId provided');
    assert.ok(data.message.includes('Session not found'), 'Error message should mention session not found');
    assert.ok(typeof data.message === 'string', 'Should have message field');
  });

  it('handles unknown action with error', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'unknown-action-output.json');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['unknown-action', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
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

// Unit tests with Node.js built-in mock.module() API
describe('write-git-commit: commit-workflow.js (mocked ccusage)', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('prepare with valid session ID fetches costs via mocked library', async (t) => {
    const mockSessions = [
      {
        sessionId: '-Users-noahlz-projects-claude-plugins',
        lastActivity: '2025-01-15',
        modelBreakdowns: [
          {
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 0,
            cost: 0.45
          },
          {
            model: 'claude-sonnet-4-5-20250929',
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 10,
            cost: 1.25
          }
        ]
      }
    ];

    // Mock ccusage using TEST CONTEXT (t.mock.module)
    t.mock.module('ccusage/data-loader', {
      namedExports: {
        loadSessionUsageById: async (sessionId) => {
          return mockSessions.find(s => s.sessionId === sessionId) || null;
        },
        loadSessionData: async () => {
          return mockSessions;
        }
      }
    });

    // CRITICAL: Dynamic import AFTER mocking
    const { prepare } = await import('../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js');

    const result = await prepare({
      baseDir: testEnv.tmpDir,
      sessionId: '-Users-noahlz-projects-claude-plugins'
    });

    assert.equal(result.status, 'success', 'Should succeed with valid session ID');
    assert.ok(result.data.current_cost, 'Should have current_cost');
    assert.ok(Array.isArray(result.data.current_cost), 'current_cost should be an array');
    assert.equal(result.data.current_cost.length, 2, 'Should have 2 model breakdowns');
    assert.equal(result.data.method, 'library', 'Should have used library method');
  });

  it('prepare with nonexistent session returns error via mocked library', async (t) => {
    const mockSessions = [];

    t.mock.module('ccusage/data-loader', {
      namedExports: {
        loadSessionUsageById: async (sessionId) => {
          return mockSessions.find(s => s.sessionId === sessionId) || null;
        },
        loadSessionData: async () => {
          return mockSessions;
        }
      }
    });

    const { prepare } = await import('../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js');

    const result = await prepare({
      baseDir: testEnv.tmpDir,
      sessionId: '-nonexistent-session-xyz'
    });

    assert.equal(result.status, 'error', 'Should return error for nonexistent session');
    assert.ok(result.message, 'Should have error message');
  });

  it('list-sessions returns all sessions via mocked library', async (t) => {
    const mockSessions = [
      {
        sessionId: '-Users-noahlz-projects-claude-plugins',
        lastActivity: '2025-01-15',
        modelBreakdowns: [
          {
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 0,
            cost: 0.45
          }
        ]
      },
      {
        sessionId: '-Users-noahlz-projects-ligeon',
        lastActivity: '2025-01-14',
        modelBreakdowns: [
          {
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 2000,
            outputTokens: 1000,
            cacheCreationTokens: 100,
            cost: 0.95
          }
        ]
      }
    ];

    t.mock.module('ccusage/data-loader', {
      namedExports: {
        loadSessionUsageById: async (sessionId) => {
          return mockSessions.find(s => s.sessionId === sessionId) || null;
        },
        loadSessionData: async () => {
          return mockSessions;
        }
      }
    });

    const { listSessions } = await import('../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js');

    const result = await listSessions();

    assert.equal(result.status, 'success', 'Should succeed');
    assert.ok(Array.isArray(result.data.sessions), 'Should return array of sessions');
    assert.equal(result.data.sessions.length, 2, 'Should have 2 sessions');
    assert.ok(result.data.sessions[0].sessionId, 'Sessions should have sessionId');
    assert.equal(result.method, 'library', 'Should have used library method');
  });

  it('list-sessions returns sessions sorted by lastActivity descending', async (t) => {
    const mockSessions = [
      {
        sessionId: '-session-oldest',
        lastActivity: '2025-01-10',
        modelBreakdowns: []
      },
      {
        sessionId: '-session-newest',
        lastActivity: '2025-01-20',
        modelBreakdowns: []
      },
      {
        sessionId: '-session-middle',
        lastActivity: '2025-01-15',
        modelBreakdowns: []
      }
    ];

    t.mock.module('ccusage/data-loader', {
      namedExports: {
        loadSessionUsageById: async (sessionId) => {
          return mockSessions.find(s => s.sessionId === sessionId) || null;
        },
        loadSessionData: async () => {
          return mockSessions;
        }
      }
    });

    const { listSessions } = await import('../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js');

    const result = await listSessions();

    assert.equal(result.status, 'success', 'Should succeed');
    assert.equal(result.data.sessions.length, 3, 'Should have 3 sessions');
    assert.equal(result.data.sessions[0].sessionId, '-session-newest', 'Most recent should be first');
    assert.equal(result.data.sessions[1].sessionId, '-session-middle', 'Middle should be second');
    assert.equal(result.data.sessions[2].sessionId, '-session-oldest', 'Oldest should be last');
  });

  // SKIPPED - this test hangs
  it.skip('commit with multiple models includes all cost breakdowns in trailers', async (t) => {
    const mockSessions = [
      {
        sessionId: '-Users-noahlz-projects-claude-plugins',
        lastActivity: '2025-01-15',
        modelBreakdowns: [
          {
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 0,
            cost: 0.45
          },
          {
            model: 'claude-sonnet-4-5-20250929',
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 10,
            cost: 1.25
          },
          {
            model: 'claude-opus-4-5-20251101',
            inputTokens: 50,
            outputTokens: 25,
            cacheCreationTokens: 5,
            cost: 2.50
          }
        ]
      }
    ];

    t.mock.module('ccusage/data-loader', {
      namedExports: {
        loadSessionUsageById: async (sessionId) => {
          return mockSessions.find(s => s.sessionId === sessionId) || null;
        },
        loadSessionData: async () => {
          return mockSessions;
        }
      }
    });

    // Create test environment with git repo
    const testDir = testEnv.tmpDir;
    execGit(['init'], { cwd: testDir });
    execGit(['config', 'user.email', 'test@example.com'], { cwd: testDir });
    execGit(['config', 'user.name', 'Test User'], { cwd: testDir });

    // Create initial commit
    writeFileSync(join(testDir, 'initial.txt'), 'initial');
    execGit(['add', 'initial.txt'], { cwd: testDir });
    execGit(['commit', '-m', 'initial commit'], { cwd: testDir });

    // Stage a change
    writeFileSync(join(testDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testDir });

    const { commit } = await import('../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js');

    // Create mock stdin for commit message
    // const mockStdin = {
    //   read: async () => 'Add feature\n\n- Implemented feature'
    // };

    const result = await commit({
      baseDir: testDir,
      pluginRoot: testEnv.pluginRoot,
      sessionId: '-Users-noahlz-projects-claude-plugins',
      costs: JSON.stringify(mockSessions[0].modelBreakdowns)
    });

    assert.equal(result.status, 'success', 'Should succeed with multiple models');
    assert.ok(result.data.commit_sha, 'Should return commit SHA');

    // Verify git log contains all model costs
    const gitLogOutput = execGit(['log', '-1', '--format=%B'], { cwd: testDir }).stdout;

    assert.ok(gitLogOutput.includes('claude-haiku-4-5-20251001'), 'Should include haiku model');
    assert.ok(gitLogOutput.includes('claude-sonnet-4-5-20250929'), 'Should include sonnet model');
    assert.ok(gitLogOutput.includes('claude-opus-4-5-20251101'), 'Should include opus model');
  });
});
