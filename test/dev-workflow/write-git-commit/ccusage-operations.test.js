import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  pwdToSessionId,
  extractCostMetrics,
  validateCostMetrics,
  listLocalSessions,
  findRecommendedSession
} from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/ccusage-operations.js';

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

  describe('listLocalSessions', () => {
    it('returns object with status and data properties', () => {
      const result = listLocalSessions();

      // Should have proper response structure
      assert.ok('status' in result);
      assert.ok('data' in result);
      assert.ok(result.status === 'success' || result.status === 'error');
      assert.ok(Array.isArray(result.data.sessions));
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
