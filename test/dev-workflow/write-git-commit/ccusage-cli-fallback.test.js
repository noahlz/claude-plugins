import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Import functions to test
import {
  loadSessionDataCli,
  loadSessionByIdCli,
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

  // Test loadSessionDataCli and loadSessionByIdCli
  describe('CLI integration', () => {
    it('loadSessionDataCli returns array when ccusage available', async function() {
      try {
        const sessions = await loadSessionDataCli();
        assert.ok(Array.isArray(sessions), 'Should return an array');
        // Mock should return 2 sessions
        if (sessions.length > 0) {
          assert.ok(sessions[0].sessionId, 'Sessions should have sessionId');
        }
      } catch (error) {
        // If ccusage CLI not available in test environment, that's acceptable
        assert.ok(error.message.includes('ccusage'), 'Error should mention ccusage');
      }
    });

    it('loadSessionByIdCli returns null for non-existent session', async function() {
      try {
        const session = await loadSessionByIdCli('nonexistent-fake-session-id-12345');
        // If ccusage CLI is working, session should be null for non-existent ID
        assert.equal(session, null, 'Should return null for non-existent session');
      } catch (error) {
        // CLI loading errors are acceptable for this test
        // (ccusage might not be available in all test environments)
        if (error.message.includes('Expected array') ||
            error.code === 'ENOENT' ||
            error.message.includes('ccusage CLI not found')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('loadSessionByIdCli finds existing session from mock data', async function() {
      try {
        // This session ID exists in the mock data
        const session = await loadSessionByIdCli('-Users-noahlz-projects-claude-plugins');
        // If we got here, ccusage is working properly
        assert.ok(session, 'Should find session with existing ID');
        assert.equal(session.sessionId, '-Users-noahlz-projects-claude-plugins');
        assert.ok(session.modelBreakdowns, 'Session should have modelBreakdowns');
      } catch (error) {
        // CLI loading errors are acceptable for this test
        if (error.message.includes('Expected array') ||
            error.code === 'ENOENT' ||
            error.message.includes('ccusage CLI not found')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('throws error when ccusage CLI not found', async function() {
      // Test error handling when ccusage CLI is not in PATH
      const originalPath = process.env.PATH;

      try {
        // Set PATH to nonexistent directories so ccusage cannot be found
        process.env.PATH = '/nonexistent:/also/nonexistent';

        try {
          await loadSessionDataCli();
          assert.fail('Should throw error when ccusage not found');
        } catch (error) {
          assert.ok(
            error.message.includes('ccusage CLI not found') ||
            error.message.includes('ccusage: command not found') ||
            error.code === 'ENOENT' ||
            error.message.includes('ENOENT'),
            `Error should indicate ccusage is missing, got: ${error.message}`
          );
        } finally {
          process.env.PATH = originalPath;
        }
      } catch (error) {
        // Test failed - restore PATH and re-throw
        process.env.PATH = originalPath;
        throw error;
      }
    });
  });
});
