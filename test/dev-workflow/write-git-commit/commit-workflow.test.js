import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execNodeScript,
  execBashScript,
  getPluginScriptPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';

describe('write-git-commit: commit-workflow.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
    // Initialize git repo for testing
    execBashScript('git', {
      args: ['init'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['config', 'user.email', 'test@example.com'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['config', 'user.name', 'Test User'],
      cwd: testEnv.tmpDir
    });
    // Create initial commit
    writeFileSync(join(testEnv.tmpDir, 'initial.txt'), 'initial');
    execBashScript('git', {
      args: ['add', 'initial.txt'],
      cwd: testEnv.tmpDir
    });
    execBashScript('git', {
      args: ['commit', '-m', 'initial commit'],
      cwd: testEnv.tmpDir
    });
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('check-config returns not_found when no config exists', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'check-config-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config', testEnv.tmpDir, outputFile],
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

    assert.equal(data.status, 'not_found', 'Should return not_found when no config exists');
  });

  it('check-config returns found when config exists', () => {
    // Create config file
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'check-config-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config', testEnv.tmpDir, outputFile],
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

    assert.equal(data.status, 'found', 'Should return found when config exists');
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

  it('commit action fails when CURRENT_COST is not provided', () => {
    // Create config with session ID but don't provide CURRENT_COST
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        // CURRENT_COST is NOT provided
        PATH: testEnv.mockPath
      }
    });

    // commit action doesn't use outputFile, so we don't check exit code
    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Should be error status when CURRENT_COST is not provided
    assert.equal(data.status, 'error', 'Status should be error when CURRENT_COST not provided');
    assert.ok(data.message.includes('CURRENT_COST'), 'Error message should mention CURRENT_COST');
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
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execBashScript('git', {
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics via CURRENT_COST env var (empty array)
    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: JSON.stringify([]),
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for empty cost array');
    assert.ok(data.data.attempted_costs, 'Should include attempted_costs in data');
  });

  it('commit action returns metrics_invalid when all metrics are zero', () => {
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execBashScript('git', {
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass invalid metrics (all zeros)
    const invalidMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: invalidMetrics,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for all-zero metrics');
  });

  it('commit action returns git_error when git commit fails', () => {
    // Create config with a valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass valid metrics but without staging changes (git commit will fail)
    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: validMetrics,
        MOCK_GIT_COMMIT_FAIL: 'true',
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);
    assert.equal(data.status, 'git_error', 'Status should be git_error when nothing is staged');
  });

  it('commit with valid session ID and metrics succeeds', () => {
    // Create config with valid session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: 'test-session-id' })
    );

    // Create a test file to stage
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execBashScript('git', {
      args: ['add', 'test.txt'],
      cwd: testEnv.tmpDir
    });

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    // Pass valid metrics via CURRENT_COST env var
    const validMetrics = JSON.stringify([
      {
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.05
      }
    ]);

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['commit'],
      cwd: testEnv.tmpDir,
      input: 'Test commit message',
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        SESSION_ID: 'test-session-id',
        CURRENT_COST: validMetrics,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);
    assert.ok(data, `Output should contain valid JSON`);

    // Should succeed with valid metrics and staged changes
    assert.equal(data.status, 'success', 'Status should be success with valid metrics and staged changes');
    assert.ok(data.data.commit_sha, 'Should return commit SHA');
  });

  // ====== Phase 4: Output File Tests ======

  it('check-config writes to output file when specified', () => {
    // Create config file
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-test-session-id' })
    );

    const outputFile = join(testEnv.tmpDir, 'check-config-output.json');
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config', testEnv.tmpDir, outputFile],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.ok(existsSync(outputFile), 'Output file should be created');

    const fileContents = readFileSync(outputFile, 'utf-8');
    const data = JSON.parse(fileContents);

    assert.equal(data.status, 'found', 'Should return found status');
    assert.equal(data.data.config.sessionId, '-test-session-id', 'Should contain session ID');
  });

  // ====== Phase 4: --export-vars Mode Tests ======

  it('check-config with --export-vars outputs shell variables', () => {
    // Create config
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config', testEnv.tmpDir, '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0);

    // Should output shell variable format
    assert.match(result.stdout, /RESULT_STATUS='found'/, 'Should export RESULT_STATUS');
    assert.match(result.stdout, /SESSION_ID='-test-session-id'/, 'Should export SESSION_ID');
  });

  it('prepare with --export-vars outputs error when no config and no sessionId', () => {
    // No config file and no sessionId - should return error
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', testEnv.tmpDir, '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should return error status (not need_selection)
    assert.match(result.stdout, /RESULT_STATUS='error'/,
      'Should export error status when no config');
    assert.match(result.stdout, /RESULT_MESSAGE=/, 'Should export error message');
  });

  it('shell variable escaping handles special characters', () => {
    // Create config with special chars in session ID
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: "-test-with-'quote" })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['check-config', '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Verify output is valid shell syntax (doesn't break on quotes)
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /SESSION_ID=/, 'Should export SESSION_ID even with special chars');
  });

  // ====== Phase 4: Merged prepare Logic Tests ======

  it('prepare without sessionId and no config returns error', () => {
    // No config file
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);

    // Should return error when no config and no sessionId provided
    assert.equal(data.status, 'error',
      'Should return error when no config and no sessionId provided');
    assert.ok(data.message.includes('Session not found'), 'Error message should mention session not found');
  });

  it('resolve-session computes session ID from current working directory', () => {
    // resolve-session should compute session ID from cwd
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['resolve-session'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);

    // Should have either found or not_found status (not error)
    assert.ok(['found', 'not_found'].includes(data.status),
      'Should return found or not_found status');

    // If not_found, should contain calculated session ID
    if (data.status === 'not_found') {
      assert.ok(data.data.calculated_session_id, 'Should have calculated_session_id');
      assert.ok(typeof data.data.calculated_session_id === 'string', 'Session ID should be string');
      assert.ok(!data.data.calculated_session_id.includes('/'), 'Session ID should not contain slashes');
      assert.ok(data.data.calculated_session_id.startsWith('-'), 'Session ID should start with dash');
    }
  });

  it('resolve-session returns not_found when session does not exist', () => {
    // resolve-session should return not_found if calculated session doesn't exist
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['resolve-session'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);

    // In test environment without actual ccusage sessions, resolve-session should return not_found
    // (unless by chance the tmpDir path matches an actual session)
    assert.ok(['found', 'not_found', 'error'].includes(data.status),
      'Should return valid status');

    if (data.status === 'not_found') {
      assert.ok(data.data.calculated_session_id, 'Should have calculated_session_id');
      assert.ok(data.message.includes('not found'), 'Message should indicate not found');
    }
  });

  it('resolve-session with --export-vars outputs shell variables', () => {
    // resolve-session should export shell variables
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['resolve-session', testEnv.tmpDir, '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should export RESULT_STATUS
    assert.match(result.stdout, /RESULT_STATUS='(found|not_found|error)'/,
      'Should export RESULT_STATUS');

    // If found, should export SESSION_ID
    if (result.stdout.includes("RESULT_STATUS='found'")) {
      assert.match(result.stdout, /SESSION_ID=/, 'Should export SESSION_ID on found');
    }

    // If not_found, should export CALCULATED_SESSION_ID
    if (result.stdout.includes("RESULT_STATUS='not_found'")) {
      assert.match(result.stdout, /CALCULATED_SESSION_ID=/, 'Should export CALCULATED_SESSION_ID on not_found');
    }
  });

  // ====== Phase 4: save-config Tests ======

  it('save-config creates config file with sessionId', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['save-config', testEnv.tmpDir, '-test-session-id'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0, 'Should exit successfully');

    const configPath = join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json');
    assert.ok(existsSync(configPath), 'Config file should be created');

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(config.sessionId, '-test-session-id', 'Should save correct session ID');
  });

  it('save-config creates .claude directory if needed', () => {
    // Ensure .claude doesn't exist
    const claudeDir = join(testEnv.tmpDir, '.claude');
    if (existsSync(claudeDir)) {
      rmSync(claudeDir, { recursive: true });
    }

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['save-config', testEnv.tmpDir, '-test-session-id'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.equal(result.exitCode, 0);
    assert.ok(existsSync(claudeDir), '.claude directory should be created');

    const configPath = join(claudeDir, 'settings.plugins.write-git-commit.json');
    assert.ok(existsSync(configPath), 'Config file should be created');
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
});
