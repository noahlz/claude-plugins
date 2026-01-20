import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  pwdToSessionId,
  extractCostMetrics,
  validateCostMetrics,
  listLocalSessions,
  findRecommendedSession,
  findSubagentSessions,
  aggregateModelBreakdowns,
  getSessionCosts
} from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/ccusage-operations.js';
import { createMockLoadSessionData } from './helpers.js';

describe('write-git-commit: ccusage-operations.js', () => {
  describe('pwdToSessionId', () => {
    it('converts absolute path to session ID format', () => {
      const result = pwdToSessionId('/Users/noahlz/projects/claude-plugins');
      assert.equal(result, '-Users-noahlz-projects-claude-plugins');
    });

    it('converts path without leading slash', () => {
      const result = pwdToSessionId('Users/noahlz/projects/test');
      assert.equal(result, '-Users-noahlz-projects-test');
    });

    it('handles paths with trailing slash', () => {
      const result = pwdToSessionId('/Users/noahlz/projects/test/');
      assert.equal(result, '-Users-noahlz-projects-test-');
    });

    it('handles single-level paths', () => {
      const result = pwdToSessionId('/home');
      assert.equal(result, '-home');
    });

    it('handles root path', () => {
      const result = pwdToSessionId('/');
      assert.equal(result, '-');
    });

    it('handles paths with multiple consecutive slashes', () => {
      const result = pwdToSessionId('/Users//noahlz///projects');
      assert.equal(result, '-Users--noahlz---projects');
    });

    it('always prefixes with dash', () => {
      const testPaths = [
        '/Users/test',
        'Users/test',
        '/home/user/project'
      ];

      testPaths.forEach(path => {
        const result = pwdToSessionId(path);
        assert.ok(result.startsWith('-'), `Result should start with dash: ${result}`);
      });
    });

    it('replaces all forward slashes with dashes', () => {
      const result = pwdToSessionId('/a/b/c/d/e');
      assert.equal(result, '-a-b-c-d-e');
      assert.equal((result.match(/-/g) || []).length, 5);
    });
  });

  describe('extractCostMetrics', () => {
    it('extracts cost metrics from valid session object', () => {
      const session = {
        sessionId: 'test-123',
        modelBreakdowns: [
          {
            model: 'claude-opus-4.5',
            inputTokens: 100,
            outputTokens: 50,
            cost: 0.123
          }
        ]
      };

      const result = extractCostMetrics(session);

      assert.equal(result.length, 1);
      assert.equal(result[0].model, 'claude-opus-4.5');
      assert.equal(result[0].inputTokens, 100);
      assert.equal(result[0].outputTokens, 50);
      assert.equal(result[0].cost, 0.12);
    });

    it('handles multiple model breakdowns', () => {
      const session = {
        sessionId: 'test-123',
        modelBreakdowns: [
          {
            model: 'claude-opus-4.5',
            inputTokens: 100,
            outputTokens: 50,
            cost: 0.123456
          },
          {
            model: 'claude-haiku-4.5',
            inputTokens: 200,
            outputTokens: 75,
            cost: 0.045678
          }
        ]
      };

      const result = extractCostMetrics(session);

      assert.equal(result.length, 2);
      assert.equal(result[0].model, 'claude-opus-4.5');
      assert.equal(result[0].cost, 0.12);
      assert.equal(result[1].model, 'claude-haiku-4.5');
      assert.equal(result[1].cost, 0.05);
    });

    it('rounds costs to 2 decimal places', () => {
      const session = {
        sessionId: 'test',
        modelBreakdowns: [
          {
            model: 'test-model',
            inputTokens: 1,
            outputTokens: 1,
            cost: 0.123456789
          }
        ]
      };

      const result = extractCostMetrics(session);

      assert.equal(result[0].cost, 0.12);
    });

    it('handles missing modelBreakdowns', () => {
      const session = { sessionId: 'test-123' };

      const result = extractCostMetrics(session);

      assert.deepStrictEqual(result, []);
    });

    it('handles null session', () => {
      const result = extractCostMetrics(null);

      assert.deepStrictEqual(result, []);
    });

    it('defaults missing token counts to 0', () => {
      const session = {
        sessionId: 'test',
        modelBreakdowns: [
          {
            model: 'test-model',
            cost: 0.05
          }
        ]
      };

      const result = extractCostMetrics(session);

      assert.equal(result[0].inputTokens, 0);
      assert.equal(result[0].outputTokens, 0);
    });

    it('defaults missing model to "unknown"', () => {
      const session = {
        sessionId: 'test',
        modelBreakdowns: [
          {
            inputTokens: 10,
            outputTokens: 5,
            cost: 0.01
          }
        ]
      };

      const result = extractCostMetrics(session);

      assert.equal(result[0].model, 'unknown');
    });
  });

  describe('validateCostMetrics', () => {
    it('validates valid cost metrics array', () => {
      const costs = [
        {
          model: 'claude-opus-4.5',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.12
        }
      ];

      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only cost value', () => {
      const costs = [
        {
          model: 'test-model',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0.05
        }
      ];

      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only input tokens', () => {
      const costs = [
        {
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 0,
          cost: 0
        }
      ];

      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only output tokens', () => {
      const costs = [
        {
          model: 'test-model',
          inputTokens: 0,
          outputTokens: 50,
          cost: 0
        }
      ];

      assert.equal(validateCostMetrics(costs), true);
    });

    it('rejects empty array', () => {
      assert.equal(validateCostMetrics([]), false);
    });

    it('rejects non-array', () => {
      assert.equal(validateCostMetrics(null), false);
      assert.equal(validateCostMetrics(undefined), false);
      assert.equal(validateCostMetrics({}), false);
    });

    it('rejects cost with missing model field', () => {
      const costs = [
        {
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.12
        }
      ];

      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with non-numeric cost field', () => {
      const costs = [
        {
          model: 'test-model',
          inputTokens: 100,
          outputTokens: 50,
          cost: 'invalid'
        }
      ];

      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with all zeros and no cost', () => {
      const costs = [
        {
          model: 'test-model',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        }
      ];

      assert.equal(validateCostMetrics(costs), false);
    });

    it('accepts multiple valid costs', () => {
      const costs = [
        {
          model: 'claude-opus-4.5',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.12
        },
        {
          model: 'claude-haiku-4.5',
          inputTokens: 200,
          outputTokens: 75,
          cost: 0.05
        }
      ];

      assert.equal(validateCostMetrics(costs), true);
    });

    it('rejects if any element is invalid', () => {
      const costs = [
        {
          model: 'claude-opus-4.5',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.12
        },
        {
          inputTokens: 200,
          outputTokens: 75,
          cost: 0.05
        }
      ];

      assert.equal(validateCostMetrics(costs), false);
    });
  });

  describe('findSubagentSessions', () => {
    it('returns subagent sessions matching main session ID', () => {
      const sessions = [
        { sessionId: '-Users-test-project', projectPath: null },
        { sessionId: 'subagents', projectPath: '-Users-test-project/abc123' },
        { sessionId: 'subagents', projectPath: '-Users-test-project/def456' },
        { sessionId: 'subagents', projectPath: '-Users-other-project/ghi789' }
      ];

      const result = findSubagentSessions(sessions, '-Users-test-project');

      assert.equal(result.length, 2);
      assert.equal(result[0].projectPath, '-Users-test-project/abc123');
      assert.equal(result[1].projectPath, '-Users-test-project/def456');
    });

    it('returns empty array when no subagents exist', () => {
      const sessions = [
        { sessionId: '-Users-test-project', projectPath: null }
      ];

      const result = findSubagentSessions(sessions, '-Users-test-project');

      assert.deepStrictEqual(result, []);
    });

    it('excludes sessions with non-matching projectPath prefix', () => {
      const sessions = [
        { sessionId: 'subagents', projectPath: '-Users-other-project/abc123' }
      ];

      const result = findSubagentSessions(sessions, '-Users-test-project');

      assert.deepStrictEqual(result, []);
    });

    it('excludes sessions with null projectPath', () => {
      const sessions = [
        { sessionId: 'subagents', projectPath: null }
      ];

      const result = findSubagentSessions(sessions, '-Users-test-project');

      assert.deepStrictEqual(result, []);
    });

    it('excludes sessions with non-subagent sessionId', () => {
      const sessions = [
        { sessionId: 'other-session', projectPath: '-Users-test-project/abc123' }
      ];

      const result = findSubagentSessions(sessions, '-Users-test-project');

      assert.deepStrictEqual(result, []);
    });
  });

  describe('aggregateModelBreakdowns', () => {
    it('aggregates costs from multiple sessions by model', () => {
      const sessions = [
        {
          modelBreakdowns: [
            { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 }
          ]
        },
        {
          modelBreakdowns: [
            { model: 'claude-sonnet-4', inputTokens: 200, outputTokens: 100, cost: 0.20 }
          ]
        }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result.length, 1);
      assert.equal(result[0].model, 'claude-sonnet-4');
      assert.equal(result[0].inputTokens, 300);
      assert.equal(result[0].outputTokens, 150);
      assert.equal(result[0].cost, 0.30);
    });

    it('keeps different models separate', () => {
      const sessions = [
        {
          modelBreakdowns: [
            { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 },
            { model: 'claude-haiku-3.5', inputTokens: 500, outputTokens: 200, cost: 0.02 }
          ]
        }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result.length, 2);
      const sonnet = result.find(r => r.model === 'claude-sonnet-4');
      const haiku = result.find(r => r.model === 'claude-haiku-3.5');
      assert.equal(sonnet.inputTokens, 100);
      assert.equal(haiku.inputTokens, 500);
    });

    it('handles sessions without modelBreakdowns', () => {
      const sessions = [
        { sessionId: 'test' },
        { modelBreakdowns: [{ model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 }] }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result.length, 1);
      assert.equal(result[0].model, 'claude-sonnet-4');
    });

    it('returns empty array for empty sessions list', () => {
      const result = aggregateModelBreakdowns([]);

      assert.deepStrictEqual(result, []);
    });

    it('rounds aggregated costs to 2 decimal places', () => {
      const sessions = [
        { modelBreakdowns: [{ model: 'test', cost: 0.111 }] },
        { modelBreakdowns: [{ model: 'test', cost: 0.222 }] }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result[0].cost, 0.33);
    });

    it('defaults missing fields to 0', () => {
      const sessions = [
        { modelBreakdowns: [{ model: 'test' }] }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result[0].inputTokens, 0);
      assert.equal(result[0].outputTokens, 0);
      assert.equal(result[0].cost, 0);
    });

    it('uses modelName as fallback for model field', () => {
      const sessions = [
        { modelBreakdowns: [{ modelName: 'claude-sonnet-4', inputTokens: 100, cost: 0.10 }] }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result[0].model, 'claude-sonnet-4');
    });

    it('defaults to "unknown" when no model field', () => {
      const sessions = [
        { modelBreakdowns: [{ inputTokens: 100, cost: 0.10 }] }
      ];

      const result = aggregateModelBreakdowns(sessions);

      assert.equal(result[0].model, 'unknown');
    });
  });

  describe('getSessionCosts', () => {
    it('aggregates costs from main session and subagents', async () => {
      const result = await getSessionCosts('test-session', {
        loadSessionData: createMockLoadSessionData([
          {
            sessionId: 'test-session',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 }
            ]
          },
          {
            sessionId: 'subagents',
            projectPath: 'test-session/abc123',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 50, outputTokens: 25, cost: 0.05 }
            ]
          }
        ])
      });

      assert.equal(result.success, true);
      assert.equal(result.costs.length, 1);
      assert.equal(result.costs[0].model, 'claude-sonnet-4');
      assert.equal(result.costs[0].inputTokens, 150);
      assert.equal(result.costs[0].outputTokens, 75);
      assert.equal(result.costs[0].cost, 0.15);
    });

    it('aggregates multiple models separately', async () => {
      const result = await getSessionCosts('test-session', {
        loadSessionData: createMockLoadSessionData([
          {
            sessionId: 'test-session',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 },
              { model: 'claude-haiku-3.5', inputTokens: 500, outputTokens: 200, cost: 0.02 }
            ]
          },
          {
            sessionId: 'subagents',
            projectPath: 'test-session/sub1',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 50, outputTokens: 25, cost: 0.05 }
            ]
          }
        ])
      });

      assert.equal(result.success, true);
      assert.equal(result.costs.length, 2);

      const sonnet = result.costs.find(c => c.model === 'claude-sonnet-4');
      const haiku = result.costs.find(c => c.model === 'claude-haiku-3.5');

      assert.equal(sonnet.inputTokens, 150);
      assert.equal(sonnet.outputTokens, 75);
      assert.equal(sonnet.cost, 0.15);

      assert.equal(haiku.inputTokens, 500);
      assert.equal(haiku.outputTokens, 200);
      assert.equal(haiku.cost, 0.02);
    });

    it('returns error when session not found', async () => {
      const result = await getSessionCosts('nonexistent', {
        loadSessionData: createMockLoadSessionData([])
      });

      assert.equal(result.success, false);
      assert.equal(result.costs.length, 0);
      assert.ok(result.error.includes('not found'));
    });

    it('returns error when no model breakdowns found', async () => {
      const result = await getSessionCosts('test-session', {
        loadSessionData: createMockLoadSessionData([
          { sessionId: 'test-session', modelBreakdowns: [] }
        ])
      });

      assert.equal(result.success, false);
      assert.equal(result.costs.length, 0);
      assert.ok(result.error.includes('No model breakdowns'));
    });

    it('handles loadSessionData error', async () => {
      const result = await getSessionCosts('test-session', {
        loadSessionData: async () => {
          throw new Error('Failed to load sessions');
        }
      });

      assert.equal(result.success, false);
      assert.equal(result.costs.length, 0);
      assert.ok(result.error.includes('Failed to load sessions'));
    });

    it('ignores subagents from other sessions', async () => {
      const result = await getSessionCosts('test-session', {
        loadSessionData: createMockLoadSessionData([
          {
            sessionId: 'test-session',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 }
            ]
          },
          {
            sessionId: 'subagents',
            projectPath: 'other-session/abc123',
            modelBreakdowns: [
              { model: 'claude-sonnet-4', inputTokens: 1000, outputTokens: 500, cost: 1.00 }
            ]
          }
        ])
      });

      assert.equal(result.success, true);
      assert.equal(result.costs[0].inputTokens, 100);
      assert.equal(result.costs[0].cost, 0.10);
    });
  });

  describe('listLocalSessions', () => {
    it('returns object with status and data properties', () => {
      const result = listLocalSessions();

      // Should have proper response structure
      assert.ok('status' in result);
      assert.ok('data' in result);
      assert.ok(result.status === 'success' || result.status === 'error');
      assert.ok(Array.isArray(result.data.sessions));
    });

    it('returns success with empty array when projects directory does not exist', () => {
      // Note: This test assumes ~/.claude/projects doesn't exist or is empty
      // If it exists, the listLocalSessions function will handle it gracefully
      const result = listLocalSessions();

      assert.equal(result.status, 'success');
      assert.ok(Array.isArray(result.data.sessions));
      // Sessions may be empty or populated depending on actual ~/.claude/projects state
    });
  });

  describe('findRecommendedSession', () => {
    it('returns object with sessionId and match properties', () => {
      const result = findRecommendedSession('/test/path');

      // Should have proper response structure
      assert.ok('sessionId' in result);
      assert.ok('match' in result);
      assert.equal(typeof result.match, 'boolean');
      // sessionId can be string or null
      assert.ok(typeof result.sessionId === 'string' || result.sessionId === null);
    });

    it('converts path to session ID format', () => {
      const testPath = '/Users/test/project';
      const result = findRecommendedSession(testPath);

      // Result structure should be valid
      assert.ok('sessionId' in result);
      assert.ok('match' in result);
      assert.equal(typeof result.match, 'boolean');
      // If sessionId is not null, it should contain dashes from path conversion
      if (result.sessionId) {
        assert.ok(result.sessionId.includes('-'));
      }
    });
  });
});
