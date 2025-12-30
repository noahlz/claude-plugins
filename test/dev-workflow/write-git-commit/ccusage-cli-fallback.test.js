import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Import functions to test
// Note: loadSessionDataCli and loadSessionByIdCli were removed in refactor
// These are now single-purpose scripts (verify-session-cli.js, get-session-costs-cli.js)
import {
  extractCostMetrics,
  validateCostMetrics
} from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/ccusage-cli-fallback.js';

describe('write-git-commit: ccusage-cli-fallback.js', () => {
  // Test extractCostMetrics
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
      assert.equal(result[0].cost, 0.12); // Rounded to 2 decimals
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

  // Test validateCostMetrics
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
          // Missing model
          inputTokens: 200,
          outputTokens: 75,
          cost: 0.05
        }
      ];

      assert.equal(validateCostMetrics(costs), false);
    });
  });

  // CLI integration tests removed - now in verify-session-cli.js and get-session-costs-cli.js
  // which are tested in new-scripts.test.js
});
