import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  pwdToSessionId,
  validateCostMetrics,
  filterZeroUsageCosts,
  listLocalSessions,
  findRecommendedSession
} from '../../../plugins/dev-workflow/lib/ccusage-operations.js';

describe('lib: ccusage-operations.js', () => {
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

    it('always prefixes with dash', () => {
      const testPaths = [
        '/Users/test',
        'Users/test',
        '/home/user/project'
      ];

      testPaths.forEach(p => {
        const result = pwdToSessionId(p);
        assert.ok(result.startsWith('-'), `Result should start with dash: ${result}`);
      });
    });

    it('replaces all forward slashes with dashes', () => {
      const result = pwdToSessionId('/a/b/c/d/e');
      assert.equal(result, '-a-b-c-d-e');
      assert.equal((result.match(/-/g) || []).length, 5);
    });
  });

  describe('validateCostMetrics', () => {
    it('validates valid cost metrics array', () => {
      const costs = [
        { model: 'claude-opus-4.5', inputTokens: 100, outputTokens: 50, cost: 0.12 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only cost value', () => {
      const costs = [
        { model: 'test-model', inputTokens: 0, outputTokens: 0, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only input tokens', () => {
      const costs = [
        { model: 'test-model', inputTokens: 100, outputTokens: 0, cost: 0 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only output tokens', () => {
      const costs = [
        { model: 'test-model', inputTokens: 0, outputTokens: 50, cost: 0 }
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
        { inputTokens: 100, outputTokens: 50, cost: 0.12 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with non-numeric cost field', () => {
      const costs = [
        { model: 'test-model', inputTokens: 100, outputTokens: 50, cost: 'invalid' }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with all zeros and no cost', () => {
      const costs = [
        { model: 'test-model', inputTokens: 0, outputTokens: 0, cost: 0 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('accepts multiple valid costs', () => {
      const costs = [
        { model: 'claude-opus-4.5', inputTokens: 100, outputTokens: 50, cost: 0.12 },
        { model: 'claude-haiku-4.5', inputTokens: 200, outputTokens: 75, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('rejects if any element is invalid', () => {
      const costs = [
        { model: 'claude-opus-4.5', inputTokens: 100, outputTokens: 50, cost: 0.12 },
        { inputTokens: 200, outputTokens: 75, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });
  });

  describe('filterZeroUsageCosts', () => {
    it('filters out entries with all zeros', () => {
      const costs = [
        { model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, cost: 0.10 },
        { model: 'claude-haiku-3.5', inputTokens: 0, outputTokens: 0, cost: 0 }
      ];
      const result = filterZeroUsageCosts(costs);
      assert.equal(result.filtered.length, 1);
      assert.equal(result.filtered[0].model, 'claude-sonnet-4');
      assert.equal(result.removed.length, 1);
      assert.equal(result.removed[0].model, 'claude-haiku-3.5');
    });

    it('keeps entries with any non-zero value', () => {
      const costs = [
        { model: 'model-1', inputTokens: 100, outputTokens: 0, cost: 0 },
        { model: 'model-2', inputTokens: 0, outputTokens: 50, cost: 0 },
        { model: 'model-3', inputTokens: 0, outputTokens: 0, cost: 0.05 }
      ];
      const result = filterZeroUsageCosts(costs);
      assert.equal(result.filtered.length, 3);
      assert.equal(result.removed.length, 0);
    });

    it('handles empty array', () => {
      const result = filterZeroUsageCosts([]);
      assert.deepStrictEqual(result.filtered, []);
      assert.deepStrictEqual(result.removed, []);
    });

    it('handles non-array input', () => {
      const result = filterZeroUsageCosts(null);
      assert.deepStrictEqual(result.filtered, []);
      assert.deepStrictEqual(result.removed, []);
    });
  });

  describe('listLocalSessions', () => {
    it('returns object with status and data properties', () => {
      const result = listLocalSessions();
      assert.ok('status' in result);
      assert.ok('data' in result);
      assert.ok(result.status === 'success' || result.status === 'error');
      assert.ok(Array.isArray(result.data.sessions));
    });

    it('returns success with sessions array', () => {
      const result = listLocalSessions();
      assert.equal(result.status, 'success');
      assert.ok(Array.isArray(result.data.sessions));
    });
  });

  describe('findRecommendedSession', () => {
    it('returns object with sessionId and match properties', () => {
      const result = findRecommendedSession('/test/path');
      assert.ok('sessionId' in result);
      assert.ok('match' in result);
      assert.equal(typeof result.match, 'boolean');
      assert.ok(typeof result.sessionId === 'string' || result.sessionId === null);
    });

    it('converts path to session ID format', () => {
      const testPath = '/Users/test/project';
      const result = findRecommendedSession(testPath);
      assert.ok('sessionId' in result);
      assert.ok('match' in result);
      assert.equal(typeof result.match, 'boolean');
      if (result.sessionId) {
        assert.ok(result.sessionId.includes('-'));
      }
    });
  });

  describe('loadBlockData', () => {
    it('is exported as a function', async () => {
      const { loadBlockData } = await import('../../../plugins/dev-workflow/lib/ccusage-operations.js');
      assert.equal(typeof loadBlockData, 'function');
    });
  });
});
