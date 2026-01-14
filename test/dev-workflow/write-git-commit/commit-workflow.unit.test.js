import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveConfig, prepare, commit, readCommitMessage }
  from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js';

describe('commit-workflow.js unit tests', () => {
  let tmpDir;
  let mockGit;
  let mockCcusage;

  const cleanup = () => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    // Create base throwing mock objects - tests override what they need
    const throwUnexpected = (name) => {
      throw new Error(`Unexpected call to ${name}`);
    };

    mockGit = {
      execGit: () => throwUnexpected('git.execGit'),
      commit: () => throwUnexpected('git.commit'),
      getHeadSha: () => throwUnexpected('git.getHeadSha')
    };

    mockCcusage = {
      loadSessionData: async () => throwUnexpected('ccusage.loadSessionData'),
      getProjectsDir: () => throwUnexpected('ccusage.getProjectsDir'),
      getSessionCosts: async () => throwUnexpected('ccusage.getSessionCosts'),
      listLocalSessions: () => throwUnexpected('ccusage.listLocalSessions'),
      findRecommendedSession: () => throwUnexpected('ccusage.findRecommendedSession'),
      pwdToSessionId: () => throwUnexpected('ccusage.pwdToSessionId'),
      extractCostMetrics: () => throwUnexpected('ccusage.extractCostMetrics'),
      validateCostMetrics: () => throwUnexpected('ccusage.validateCostMetrics')
    };
  });


  describe('saveConfig', () => {
    it('succeeds with valid sessionId', async () => {
      const result = saveConfig({ baseDir: tmpDir, sessionId: 'test-123' });

      assert.equal(result.status, 'success');
      assert.equal(result.data.session_id, 'test-123');

      const configPath = path.join(tmpDir, '.claude/settings.plugins.write-git-commit.json');
      assert.ok(fs.existsSync(configPath));

      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.equal(content.sessionId, 'test-123');

      cleanup();
    });

    it('fails when sessionId is missing', async () => {
      const result = saveConfig({ baseDir: tmpDir });

      assert.equal(result.status, 'error');
      assert.match(result.message, /sessionId parameter required/);

      cleanup();
    });

    it('creates .claude directory if missing', async () => {
      const result = saveConfig({ baseDir: tmpDir, sessionId: 'test' });

      assert.equal(result.status, 'success');

      const claudeDir = path.join(tmpDir, '.claude');
      assert.ok(fs.existsSync(claudeDir));

      const configPath = path.join(claudeDir, 'settings.plugins.write-git-commit.json');
      assert.ok(fs.existsSync(configPath));

      cleanup();
    });

    it ('saveConfig handles write errors gracefully', async () => {
      const result = saveConfig({ baseDir: '/invalid/nonexistent/path/that/does/not/exist', sessionId: 'test' });

      assert.equal(result.status, 'error');
      assert.match(result.message, /Failed to save config/);

      cleanup();
    });
  });

  describe("prepare command", () => {
    it('succeeds with valid sessionId and ccusage match', async () => {
      // Create test-specific mocks - only override what this test uses
      const testCcusage = {
        ...mockCcusage,
        findRecommendedSession: () => ({ match: true, sessionId: 'abc123' }),
        getSessionCosts: async () => ({
          success: true,
          costs: [{ model: 'claude-opus', cost: 0.015 }]
        }),
        validateCostMetrics: () => true
      };

      const result = await prepare({
        baseDir: '.',
        deps: { ccusage: testCcusage }
      });

      assert.equal(result.status, 'success');
      assert.equal(result.data.session_id, 'abc123');
      assert.ok(result.data.current_cost);

      cleanup();
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

      cleanup();
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

      cleanup();
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

      cleanup();
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

      cleanup();
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

      cleanup();
    });
  });

  describe("commit action command", () => {
    describe("parameter validation", () => {
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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

        cleanup();
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
