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
import { setupGitRepo } from './helpers.js';

/** Test commit-workflow.js (commit-with-costs) against a temporary git repository. */
describe('commit-with-costs: commit-workflow.js integration tests', () => {
  let testEnv;

  // Create a temporary directory and make it a git repo.
  beforeEach(() => {
    testEnv = setupTestEnv();
    setupGitRepo(testEnv);
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe("prepare action", () => {
    it('returns "not_found" status when config does not exist', async () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');
      const outputFile = join(testEnv.tmpDir, 'prepare-output.json');

      execNodeScript(scriptPath, {
        args: ['prepare', testEnv.tmpDir, '', outputFile],
        cwd: testEnv.tmpDir
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

    it('with explicit valid sessionId returns valid status and includes method field', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

      const result = execNodeScript(scriptPath, {
        args: ['prepare', testEnv.tmpDir, '-Users-noahlz-projects-claude-plugins'],
        cwd: testEnv.tmpDir
      });

      const data = extractJsonFromOutput(result.stdout);

      // Should either succeed or fail gracefully (depending on whether session exists)
      assert.ok(['success', 'error', 'invalid_costs'].includes(data.status), 'Should return valid status');
      if (data.status === 'success') {
        assert.ok(data.data.current_cost, 'Should have current_cost on success');
        assert.ok(Array.isArray(data.data.current_cost), 'current_cost should be array');
        // New fields: method and since
        assert.ok(['inc', 'cum'].includes(data.data.method), 'Should have method field');
        assert.ok('since' in data.data, 'Should have since field (can be null)');
      }
    });

    it('handles unknown action with error', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');
      const outputFile = join(testEnv.tmpDir, 'unknown-action-output.json');

      const result = execNodeScript(scriptPath, {
        args: ['unknown-action', outputFile],
        cwd: testEnv.tmpDir
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
  });

  describe("fetch-cost action (alias for prepare)", () => {
    it('returns "not_found" status when config does not exist', async () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');
      const outputFile = join(testEnv.tmpDir, 'fetch-cost-output.json');

      execNodeScript(scriptPath, {
        args: ['fetch-cost', testEnv.tmpDir, '', outputFile],
        cwd: testEnv.tmpDir
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

    it('with explicit valid sessionId returns valid status', () => {
      const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

      const result = execNodeScript(scriptPath, {
        args: ['fetch-cost', testEnv.tmpDir, '-Users-noahlz-projects-claude-plugins'],
        cwd: testEnv.tmpDir
      });

      const data = extractJsonFromOutput(result.stdout);

      assert.ok(['success', 'error', 'invalid_costs'].includes(data.status), 'Should return valid status');
      if (data.status === 'success') {
        assert.ok(data.data.current_cost, 'Should have current_cost on success');
        assert.ok(Array.isArray(data.data.current_cost), 'current_cost should be array');
      }
    });
  });

  describe("commit action", () => {
    describe("CLI argument handling", () => {
      it('with --session-id and --costs succeeds', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const validMetrics = JSON.stringify([
          {
            model: 'test-model',
            in: 100,
            out: 50,
            cost: 0.05
          }
        ]);

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'success', 'Status should be success with CLI arguments');
        assert.ok(data.data.commit_sha, 'Should return commit SHA');
      });

      it('with --method and --since flags creates correct trailer', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const validMetrics = JSON.stringify([
          { model: 'test-model', in: 100, out: 50, cost: 0.05 }
        ]);

        const result = execNodeScript(scriptPath, {
          args: [
            'commit',
            '--session-id', 'test-session-123',
            '--costs', validMetrics,
            '--method', 'inc',
            '--since', '2026-03-05T10:00:00Z'
          ],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'success', 'Status should be success');

        // Verify commit message contains the correct trailer
        const gitLogResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });
        const trailerMatch = gitLogResult.stdout.match(/Claude-Cost-Metrics: (.+)/);
        assert.ok(trailerMatch, 'Should have Claude-Cost-Metrics trailer');
        const trailerObj = JSON.parse(trailerMatch[1]);
        assert.equal(trailerObj.method, 'inc');
        assert.equal(trailerObj.since, '2026-03-05T10:00:00Z');
      });

      it('fails when --session-id is missing', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const validMetrics = JSON.stringify([
          { model: 'test-model', in: 100, out: 50, cost: 0.05 }
        ]);

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--costs', validMetrics],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'error', 'Status should be error when session ID missing');
        assert.ok(data.message.includes('--session-id'), 'Error should mention --session-id argument');
      });

      it('fails when --costs is missing', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123'],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'error', 'Status should be error when costs missing');
        assert.ok(data.message.includes('--costs'), 'Error should mention --costs argument');
      });
    });

    describe("validation", () => {
      it('returns metrics_invalid when metrics validation fails', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        // Pass invalid metrics via CLI args (empty array)
        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', JSON.stringify([])],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for empty cost array');
        assert.ok(data.data.attempted_costs, 'Should include attempted_costs in data');
      });

      it('returns metrics_invalid when all metrics are zero', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const invalidMetrics = JSON.stringify([
          { model: 'test-model', in: 0, out: 0, cost: 0 }
        ]);

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', invalidMetrics],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'metrics_invalid', 'Status should be metrics_invalid for all-zero metrics');
      });

      it('succeeds when some metrics are zero (filtered out)', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const mixedMetrics = JSON.stringify([
          { model: 'valid-model', in: 100, out: 50, cost: 0.05 },
          { model: 'zero-model', in: 0, out: 0, cost: 0 }
        ]);

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', mixedMetrics],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);

        // After filtering, should succeed (zero entries filtered before validation)
        assert.equal(data.status, 'success', 'Should succeed with mixed data after filtering');
        assert.ok(data.data.commit_sha, 'Should return commit SHA');
      });
    });

    describe("git integration", () => {
      it('returns git_error when git commit fails', () => {
        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        // Pass valid metrics but without staging changes (git commit will fail)
        const validMetrics = JSON.stringify([
          { model: 'test-model', in: 100, out: 50, cost: 0.05 }
        ]);

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
          cwd: testEnv.tmpDir,
          input: 'Test commit message'
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.ok(data, `Output should contain valid JSON`);
        assert.equal(data.status, 'git_error', 'Status should be git_error when nothing is staged');
      });

      it('handles message with subject and body bullets', () => {
        writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
        execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

        const scriptPath = getPluginScriptPath('dev-workflow', 'commit-with-costs', 'commit-workflow.js');

        const validMetrics = JSON.stringify([
          { model: 'test-model', in: 100, out: 50, cost: 0.05 }
        ]);

        const messageWithBody = 'Add new feature\n\n- Implemented core functionality\n- Added unit tests';

        const result = execNodeScript(scriptPath, {
          args: ['commit', '--session-id', 'test-session-123', '--costs', validMetrics],
          cwd: testEnv.tmpDir,
          input: messageWithBody
        });

        const data = extractJsonFromOutput(result.stdout);
        assert.equal(data.status, 'success', 'Should succeed with multi-line message');

        const gitLogResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });

        assert.ok(gitLogResult.stdout.includes('Add new feature'), 'Should contain subject');
        assert.ok(gitLogResult.stdout.includes('- Implemented core functionality'), 'Should contain first bullet');
        assert.ok(gitLogResult.stdout.includes('- Added unit tests'), 'Should contain second bullet');
      });
    });
  });
});
