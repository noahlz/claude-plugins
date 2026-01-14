import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { saveConfig, prepare, commit, readCommitMessage }
  from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js';
import {
  setupTestEnv,
  teardownTestEnv,
  createMockCcusage,
  createMockGit,
  assertResultStatus,
  createValidCosts
} from './helpers.js';

describe('commit-workflow.js unit tests', () => {
  let testEnv;
  let mockGit;
  let mockCcusage;

  beforeEach(() => {
    testEnv = setupTestEnv();
    mockGit = createMockGit();
    mockCcusage = createMockCcusage();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });


  describe('saveConfig', () => {
    it('succeeds with valid sessionId', async () => {
      const result = saveConfig({ baseDir: testEnv.tmpDir, sessionId: 'test-123' });

      assert.equal(result.status, 'success');
      assert.equal(result.data.session_id, 'test-123');

      const configPath = path.join(testEnv.tmpDir, '.claude/settings.plugins.write-git-commit.json');
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

      const configPath = path.join(claudeDir, 'settings.plugins.write-git-commit.json');
      assert.ok(fs.existsSync(configPath));

    });

    it ('saveConfig handles write errors gracefully', async () => {
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

    it('succeeds with valid sessionId and ccusage match', async () => {
      const testCcusage = createMockCcusage({
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        getSessionCosts: async () => ({
          success: true,
          costs: createValidCosts()
        }),
        validateCostMetrics: () => true
      });

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage }
      });

      assertResultStatus(result, 'success', {
        dataChecks: { session_id: 'abc123' }
      });
      assert.ok(result.data.current_cost);

    });

    it('returns not_found when no session matches', async () => {
      // Create test-specific mocks
      const testCcusage = {
        ...mockCcusage,
        findRecommendedSession: () => ({ match: false, sessionId: null }),
        pwdToSessionId: () => 'calculated-session-id'
      };

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'not_found');
      assert.ok(result.data.calculated_session_id);
      assert.match(result.message, /Session not found/);

    });

    it('returns error when ccusage.getSessionCosts fails', async () => {
      // Create test-specific mocks
      const testCcusage = {
        ...mockCcusage,
        getSessionCosts: async () => ({
          success: false,
          error: 'API error'
        })
      };

      const result = await prepare({
        sessionId: 'test-123',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'error');
      assert.equal(result.message, 'API error');

    });

    it('handles unexpected errors in catch block', async () => {
      // Create test-specific mocks
      const testCcusage = {
        ...mockCcusage,
        getSessionCosts: async () => {
          throw new Error('Unexpected error');
        }
      };

      const result = await prepare({
        sessionId: 'test-123',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'error');
      assert.match(result.message, /Unexpected error/);

    });

    it('returns invalid_costs when validation fails', async () => {
      // Create test-specific mocks
      const testCcusage = {
        ...mockCcusage,
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        getSessionCosts: async () => ({
          success: true,
          costs: [{ model: 'claude-opus', cost: 0 }] // All-zero cost
        }),
        validateCostMetrics: (costs) => false // Validation fails
      };

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'invalid_costs');
      assert.equal(result.data.session_id, 'abc123');
      assert.ok(result.data.costs);
      assert.match(result.message, /validation failed/);

    });

    it('returns invalid_costs when costs array is empty', async () => {
      const testCcusage = {
        ...mockCcusage,
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        getSessionCosts: async () => ({
          success: true,
          costs: [] // Empty array
        }),
        validateCostMetrics: (costs) => false
      };

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'invalid_costs');
      assert.match(result.message, /validation failed/);

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
        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

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
        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

        const result = await commit({
          message: 'Test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Session ID not provided/);

      });

      it('fails when costs is missing', async () => {
        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          deps: { git: mockGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'error');
        assert.match(result.message, /Cost metrics not provided/);

      });

      it('handles invalid JSON in costs string', async () => {
        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

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
        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => false
        };

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
        // Create test-specific mocks
        const testGit = {
          ...mockGit,
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => 'abc123def456',
          execGit: () => ({ exitCode: 0, stdout: '', stderr: '' })
        };

        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

        const result = await commit({
          message: 'Subject\n\nBody',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'success');
        assert.equal(result.data.commit_sha, 'abc123def456');

      });

      it('returns git_error when git.commit fails', async () => {
        const testGit = {
          ...mockGit,
          commit: () => ({
            exitCode: 1,
            stderr: 'nothing to commit'
          })
        };

        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

        const result = await commit({
          message: 'Test',
          sessionId: 'test',
          costs: [{ model: 'claude-opus', cost: 0.015 }],
          deps: { git: testGit, ccusage: testCcusage }
        });

        assert.equal(result.status, 'git_error');
        assert.ok(result.data.error_message);

      });

      it('returns git_error when getHeadSha returns null', async () => {
        const testGit = {
          ...mockGit,
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => null
        };

        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

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
        const testGit = {
          ...mockGit,
          commit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
          getHeadSha: () => 'abc123',
          execGit: () => ({
            exitCode: 0,
            stdout: 'file.txt\n',
            stderr: ''
          })
        };

        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

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
        const testGit = {
          ...mockGit,
          commit: () => {
            throw new Error('Unexpected');
          }
        };

        const testCcusage = {
          ...mockCcusage,
          validateCostMetrics: () => true
        };

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
