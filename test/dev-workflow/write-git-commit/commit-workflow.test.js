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
      args: ['check-config', outputFile],
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
      args: ['check-config', outputFile],
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

  it('prepare action returns need_selection when config does not exist', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'prepare-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '', outputFile],  // empty string sessionId, outputFile at argv[4]
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

    // Status should be need_selection when no config file exists (Phase 2: merged check-config into prepare)
    assert.equal(data.status, 'need_selection', 'Should return need_selection when no config exists');
    assert.ok(Array.isArray(data.data.sessions), 'Should have sessions array in data');
    assert.ok(typeof data.data.recommended === 'string', 'Should have recommended session in data');
    assert.ok(typeof data.message === 'string', 'Should have message field');
  });

  it('prepare action loads config and attempts to resolve costs', () => {
    // Create config file
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'prepare-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '', outputFile],
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

    // When config exists, prepare() now attempts to resolve costs via library or CLI
    // In test environment without actual ccusage sessions, this will return error
    assert.ok(
      data.status === 'success' || data.status === 'error',
      'Should return success or error based on cost resolution'
    );
    // If error, should include session_id and error message
    if (data.status === 'error') {
      assert.equal(data.data.session_id, '-test-session-id', 'Should include session ID in error response');
      assert.ok(data.message, 'Should include error message');
    }
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

  it('prepare with sessionId parameter returns error for nonexistent session', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'prepare-nonexistent-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '-nonexistent-session-id-xyz', outputFile],
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

    // Status should be error when session cannot be found
    // (assuming ccusage library or CLI is not available, or session doesn't exist)
    assert.ok(
      data.status === 'error' || data.status === 'no_config',
      'Should return error or no_config for nonexistent session'
    );
  });

  it('list-sessions returns data array with available sessions', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');
    const outputFile = join(testEnv.tmpDir, 'list-sessions-output.json');

    execNodeScript('dev-workflow', scriptPath, {
      args: ['list-sessions', outputFile],
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

    // Should have status field
    assert.ok(['success', 'error'].includes(data.status), 'Status should be success or error');

    // Should have data field (array or empty array if no sessions)
    assert.ok(Array.isArray(data.data) || data.data === undefined, 'Data should be array or undefined');
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
      args: ['check-config', outputFile],
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

  it('list-sessions writes to output file when specified', () => {
    const outputFile = join(testEnv.tmpDir, 'list-sessions-output.json');
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['list-sessions', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // May succeed or fail depending on ccusage availability
    assert.ok(existsSync(outputFile), 'Output file should be created');

    const fileContents = readFileSync(outputFile, 'utf-8');
    const data = JSON.parse(fileContents);

    assert.ok(['success', 'error'].includes(data.status), 'Should have valid status');
  });

  it('prepare writes to output file when specified', () => {
    const outputFile = join(testEnv.tmpDir, 'prepare-output.json');
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '-nonexistent-session-id', outputFile],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    assert.ok(existsSync(outputFile), 'Output file should be created');

    const fileContents = readFileSync(outputFile, 'utf-8');
    const data = JSON.parse(fileContents);

    assert.ok(['error', 'no_config', 'need_selection', 'no_sessions'].includes(data.status),
      'Should have valid status');
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
      args: ['check-config', '--export-vars'],
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

  it('prepare with --export-vars outputs shell variables on success', () => {
    // Create config
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-test-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // May succeed or fail depending on ccusage, but should output shell vars
    assert.match(result.stdout, /RESULT_STATUS='(success|error|need_selection)'/,
      'Should export RESULT_STATUS');

    // If success, should have SESSION_ID and CURRENT_COST
    if (result.stdout.includes("RESULT_STATUS='success'")) {
      assert.match(result.stdout, /SESSION_ID=/, 'Should export SESSION_ID on success');
      assert.match(result.stdout, /CURRENT_COST=/, 'Should export CURRENT_COST on success');
    }
  });

  it('prepare with --export-vars outputs sessions list on need_selection', () => {
    // No config file - should trigger need_selection
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '--export-vars'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    // Should either need_selection or no_sessions depending on ccusage availability
    assert.match(result.stdout, /RESULT_STATUS='(need_selection|no_sessions)'/,
      'Should export appropriate status');

    if (result.stdout.includes("RESULT_STATUS='need_selection'")) {
      assert.match(result.stdout, /SESSIONS=/, 'Should export SESSIONS');
      assert.match(result.stdout, /RECOMMENDED_SESSION=/, 'Should export RECOMMENDED_SESSION');
    }
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

  it('prepare without sessionId loads from config if exists', () => {
    // Create config
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-test-session-id' })
    );

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

    // Should auto-load from config and attempt to fetch costs
    // Status depends on ccusage availability, but should not be need_selection
    assert.notEqual(data.status, 'need_selection',
      'Should not return need_selection when config exists');
  });

  it('prepare without sessionId and no config returns need_selection', () => {
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

    // Should return need_selection or no_sessions
    assert.ok(['need_selection', 'no_sessions'].includes(data.status),
      'Should return need_selection or no_sessions when no config');

    if (data.status === 'need_selection') {
      assert.ok(data.data.sessions, 'Should include sessions list');
      assert.ok(data.data.recommended, 'Should include recommended session');
    }
  });

  it('prepare computes recommended session from current working directory', () => {
    // No config
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

    if (data.status === 'need_selection') {
      // Recommended should be computed from cwd and contain dashes (no slashes)
      assert.ok(data.data.recommended, 'Should have recommended session');
      assert.ok(typeof data.data.recommended === 'string', 'Recommended should be string');
      assert.ok(!data.data.recommended.includes('/'), 'Recommended should not contain slashes');
      // Should be derived from path, so contains multiple dashes
      assert.ok(data.data.recommended.includes('-'), 'Recommended should be path-derived (contains dashes)');
    }
  });

  it('prepare with explicit sessionId bypasses config check', () => {
    // Create config with different session
    mkdirSync(join(testEnv.tmpDir, '.claude'), { recursive: true });
    writeFileSync(
      join(testEnv.tmpDir, '.claude', 'settings.plugins.write-git-commit.json'),
      JSON.stringify({ sessionId: '-config-session-id' })
    );

    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['prepare', '-explicit-session-id'],
      cwd: testEnv.tmpDir,
      env: {
        CLAUDE_PLUGIN_ROOT: testEnv.pluginRoot,
        PATH: testEnv.mockPath
      }
    });

    const data = extractJsonFromOutput(result.stdout);

    // Should use explicit session, not config session
    // Won't be need_selection since session was provided
    assert.notEqual(data.status, 'need_selection',
      'Should not trigger selection when explicit session provided');
  });

  // ====== Phase 4: save-config Tests ======

  it('save-config creates config file with sessionId', () => {
    const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

    const result = execNodeScript('dev-workflow', scriptPath, {
      args: ['save-config', '-test-session-id'],
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
      args: ['save-config', '-test-session-id'],
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
