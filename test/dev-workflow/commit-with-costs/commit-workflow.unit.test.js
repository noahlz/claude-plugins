import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { saveConfig, prepare, commit, readCommitMessage }
  from '../../../plugins/dev-workflow/skills/commit-with-costs/scripts/commit-workflow.js';
import {
  setupTestEnv,
  teardownTestEnv,
  createMockCcusage,
  createMockGit,
  createMockCost,
  assertResultStatus,
  createValidCosts
} from './helpers.js';

describe('commit-with-costs: commit-workflow.js unit tests', () => {
  let testEnv;
  let mockGit;

  beforeEach(() => {
    testEnv = setupTestEnv();
    mockGit = createMockGit();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });


  describe('saveConfig', () => {
    it('succeeds with valid sessionId', async () => {
      const result = saveConfig({ baseDir: testEnv.tmpDir, sessionId: 'test-123' });

      assert.equal(result.status, 'success');
      assert.equal(result.data.session_id, 'test-123');

      const configPath = path.join(testEnv.tmpDir, '.claude/settings.plugins.commit-with-costs.json');
      assert.ok(fs.existsSync(configPath));

      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.equal(content.sessionId, 'test-123');

    });

    it('fails when sessionId is missing', async () => {
      const result = saveConfig({ baseDir: testEnv.tmpDir });

      assert.equal(result.status, 'error');
      assert.match(result.message, /sessionId parameter required/);

    });

    it('creates .claude directory if missing', async () => {
      const result = saveConfig({ baseDir: testEnv.tmpDir, sessionId: 'test' });

      assert.equal(result.status, 'success');

      const claudeDir = path.join(testEnv.tmpDir, '.claude');
      assert.ok(fs.existsSync(claudeDir));

      const configPath = path.join(claudeDir, 'settings.plugins.commit-with-costs.json');
      assert.ok(fs.existsSync(configPath));

    });

    it('saveConfig handles write errors gracefully', async () => {
      const result = saveConfig({ baseDir: '/invalid/nonexistent/path/that/does/not/exist', sessionId: 'test' });

      assert.equal(result.status, 'error');
      assert.match(result.message, /Failed to save config/);

    });
  });

  describe("prepare command", () => {
    it('throws error when deps parameter is missing', async () => {
      await assert.rejects(
        async () => prepare({ baseDir: '.' }),
        /deps parameter required/,
        'Should throw error when deps is missing'
      );
    });

    it('succeeds with valid sessionId and session match', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        validateCostMetrics: () => true
      });
      const testGit = createMockGit({
        getLastCostCommitDate: () => null
      });
      const testCost = createMockCost({
        computeCosts: async () => ({
          success: true,
          method: 'cum',
          since: null,
          costs: createValidCosts()
        })
      });

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assertResultStatus(result, 'success', {
        dataChecks: { session_id: 'abc123' }
      });
      assert.ok(result.data.current_cost);
      assert.equal(result.data.method, 'cum');
      assert.equal(result.data.since, null);

    });

    it('returns not_found when no session matches', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: false, sessionId: null }),
        pwdToSessionId: () => 'calculated-session-id'
      });
      const testGit = createMockGit({ getLastCostCommitDate: () => null });
      const testCost = createMockCost();

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'not_found');
      assert.ok(result.data.calculated_session_id);
      assert.match(result.message, /Session not found/);

    });

    it('returns error when computeCosts fails', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        validateCostMetrics: () => true
      });
      const testGit = createMockGit({ getLastCostCommitDate: () => null });
      const testCost = createMockCost({
        computeCosts: async () => ({
          success: false,
          error: 'API error'
        })
      });

      const result = await prepare({
        sessionId: 'test-123',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'error');
      assert.equal(result.message, 'API error');

    });

    it('handles unexpected errors in catch block', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' })
      });
      const testGit = createMockGit({ getLastCostCommitDate: () => null });
      const testCost = createMockCost({
        computeCosts: async () => {
          throw new Error('Unexpected error');
        }
      });

      const result = await prepare({
        sessionId: 'test-123',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'error');
      assert.match(result.message, /Unexpected error/);

    });

    it('returns invalid_costs when validation fails', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        validateCostMetrics: () => false  // Validation fails
      });
      const testGit = createMockGit({ getLastCostCommitDate: () => null });
      const testCost = createMockCost({
        computeCosts: async () => ({
          success: true,
          method: 'cum',
          since: null,
          costs: [{ model: 'claude-opus', cost: 0 }]  // All-zero cost
        })
      });

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'invalid_costs');
      assert.equal(result.data.session_id, 'abc123');
      assert.ok(Array.isArray(result.data.costs), 'costs should be an array');
      assert.ok(result.data.costs.length > 0, 'costs array should not be empty');
      assert.match(result.message, /validation failed/);

    });

    it('returns invalid_costs when costs array is empty', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        validateCostMetrics: () => false
      });
      const testGit = createMockGit({ getLastCostCommitDate: () => null });
      const testCost = createMockCost({
        computeCosts: async () => ({
          success: true,
          method: 'cum',
          since: null,
          costs: []  // Empty array
        })
      });

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'invalid_costs');
      assert.match(result.message, /validation failed/);

    });

    it('uses incremental mode when getLastCostCommitDate returns a date', async () => {
      const lastCommitDate = '2026-03-05T10:00:00Z';
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        validateCostMetrics: () => true
      });
      let capturedSessionId;
      const testGit = createMockGit({
        getLastCostCommitDate: (sessionId) => { capturedSessionId = sessionId; return lastCommitDate; }
      });
      const testCost = createMockCost({
        computeCosts: async (_sessionId, sinceDate) => ({
          success: true,
          method: sinceDate ? 'inc' : 'cum',
          since: sinceDate,
          costs: createValidCosts()
        })
      });

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage, git: testGit, cost: testCost }
      });

      assert.equal(result.status, 'success');
      assert.equal(result.data.method, 'inc');
      assert.equal(result.data.since, lastCommitDate);
      // Verify getLastCostCommitDate was called with the session ID found by findRecommendedSession
      assert.equal(capturedSessionId, 'abc123', 'Should call getLastCostCommitDate with the matched session ID');

    });
  });

  describe("commit action command", () => {
    describe("parameter validation", () => {
      it('throws error when deps parameter is missing', async () => {
        await assert.rejects(
          async () => commit({
            message: 'Test commit',
            sessionId: 'test',
            costs: [{ model: 'claude-opus', cost: 0.015 }]
          }),
          /deps parameter required/,
          'Should throw error when deps is missing'
        );
      });

      it('fails with missing subject', async () => {
        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: '',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Missing commit subject/);

      });

      it('fails when sessionId is missing', async () => {
        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Session ID not provided/);

      });

      it('fails when costs is missing', async () => {
        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Cost metrics not provided/);

      });

      it('handles invalid JSON in costs string', async () => {
        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: '{invalid-json}',
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Invalid JSON in --costs argument/);

      });

      it('validates metrics before committing', async () => {
        const testCcusage = createMockCcusage({
          validateCostMetrics: () => false
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'metrics_invalid');

      });
    });

    describe("git execution", () => {
      it('succeeds with providedMessage parameter (no stdin)', async () => {
        const testGit = createMockGit({
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => 'abc123def456',
          execGit: () => ({ exitCode: 0, stdout: '', stderr: '' })
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Subject\n\nBody',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'success');
        assert.equal(result.data.commit_sha, 'abc123def456');

      });

      it('includes method and since in trailer when provided', async () => {
        let capturedMessage = '';
        const testGit = createMockGit({
          commit: (msg) => {
            capturedMessage = msg;
            return { exitCode: 0, stdout: '', stderr: '' };
          },
          getHeadSha: () => 'abc123def456',
          execGit: () => ({ exitCode: 0, stdout: '', stderr: '' })
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        await commit({
          message: 'Subject',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015, in: 10, out: 5 }],
          method: 'inc',
          since: '2026-03-05T10:00:00Z',
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.ok(capturedMessage.includes('Claude-Cost-Metrics:'), 'Should include cost trailer');
        const trailerMatch = capturedMessage.match(/Claude-Cost-Metrics: (.+)/);
        assert.ok(trailerMatch, 'Should find trailer line');
        const trailerObj = JSON.parse(trailerMatch[1]);
        assert.equal(trailerObj.method, 'inc');
        assert.equal(trailerObj.since, '2026-03-05T10:00:00Z');
        assert.equal(trailerObj.sessionId, 'test');

      });

      it('omits since field when null (cumulative mode)', async () => {
        let capturedMessage = '';
        const testGit = createMockGit({
          commit: (msg) => {
            capturedMessage = msg;
            return { exitCode: 0, stdout: '', stderr: '' };
          },
          getHeadSha: () => 'abc123def456',
          execGit: () => ({ exitCode: 0, stdout: '', stderr: '' })
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        await commit({
          message: 'Subject',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015, in: 10, out: 5 }],
          method: 'cum',
          since: null,
          deps: { git: testGit, ccusage: testCcusage }
        });

        const trailerMatch = capturedMessage.match(/Claude-Cost-Metrics: (.+)/);
        const trailerObj = JSON.parse(trailerMatch[1]);
        assert.equal(trailerObj.method, 'cum');
        assert.equal('since' in trailerObj, false, 'since should be omitted when null');

      });

      it('returns git_error when git.commit fails', async () => {
        const testGit = createMockGit({
          commit: () => ({
            exitCode: 1,
            stderr: 'nothing to commit'
          })
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'git_error');
        assert.ok(result.data.error_message);

      });

      it('returns git_error when getHeadSha returns falsy value', async () => {
        const testGit = createMockGit({
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => ''
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'git_error');
        assert.match(result.message, /Failed to retrieve commit SHA/);

      });

      it('returns git_error when changes still staged', async () => {
        const testGit = createMockGit({
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => 'abc123',
          execGit: () => ({
            exitCode: 0,
            stdout: 'file.txt\n',
            stderr: ''
          })
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'git_error');
        assert.match(result.message, /changes still staged/);

      });

      it('handles unexpected error in catch block', async () => {
        const testGit = createMockGit({
          commit: () => {
            throw new Error('Unexpected');
          }
        });

        const testCcusage = createMockCcusage({
          validateCostMetrics: () => true
        });

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Unexpected/);

      });
    });
  });

  describe("readCommitMessage", () => {
    it('parses subject-only message', async () => {
      const stream = Readable.from([Buffer.from('Single line')]);
      const result = await readCommitMessage(stream);

      assert.equal(result.subject, 'Single line');
      assert.equal(result.body, '');
    });

    it('parses message with blank line separator', async () => {
      const stream = Readable.from([Buffer.from('Subject\n\nBody')]);
      const result = await readCommitMessage(stream);

      assert.equal(result.subject, 'Subject');
      assert.equal(result.body, 'Body');
    });

    it('parses message without blank separator', async () => {
      const stream = Readable.from([Buffer.from('Subject\nBody immediately')]);
      const result = await readCommitMessage(stream);

      assert.equal(result.subject, 'Subject');
      assert.equal(result.body, 'Body immediately');
    });

    it('handles empty input', async () => {
      const stream = Readable.from([Buffer.from('')]);
      const result = await readCommitMessage(stream);

      assert.equal(result.subject, '');
      assert.equal(result.body, '');
    });
  });
});
