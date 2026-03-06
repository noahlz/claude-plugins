import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCosts, aggregateEntriesByModel } from '../../../plugins/dev-workflow/lib/cost-computation.js';

describe('lib/cost-computation.js', () => {
  describe('aggregateEntriesByModel', () => {
    it('aggregates entries by model name', () => {
      const entries = [
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50 }, costUSD: 0.10 },
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100 }, costUSD: 0.20 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result.length, 1);
      assert.equal(result[0].model, 'claude-sonnet-4-6');
      assert.equal(result[0].inputTokens, 300);
      assert.equal(result[0].outputTokens, 150);
      assert.equal(result[0].cost, 0.30);
    });

    it('keeps different models separate', () => {
      const entries = [
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50 }, costUSD: 0.10 },
        { model: 'claude-haiku-4-5', usage: { inputTokens: 500, outputTokens: 200 }, costUSD: 0.02 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result.length, 2);
    });

    it('uses "unknown" for entries with no model', () => {
      const entries = [
        { usage: { inputTokens: 100, outputTokens: 50 }, costUSD: 0.10 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result[0].model, 'unknown');
    });

    it('rounds cost to 2 decimal places', () => {
      const entries = [
        { model: 'test', usage: { inputTokens: 1, outputTokens: 1 }, costUSD: 0.125 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result[0].cost, 0.13);
    });

    it('handles empty array', () => {
      const result = aggregateEntriesByModel([]);
      assert.deepEqual(result, []);
    });
  });

  describe('computeCosts', () => {
    const mockEntries = [
      { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50 }, costUSD: 0.10, timestamp: '2026-03-05T10:00:00Z' },
      { model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100 }, costUSD: 0.20, timestamp: '2026-03-05T11:00:00Z' }
    ];

    const mockBlocks = [{ entries: mockEntries }];

    function createTestDeps(blocks = mockBlocks) {
      return {
        loadBlockData: async () => blocks,
        filterZeroUsageCosts: (costs) => ({ filtered: costs.filter(c => c.inputTokens > 0 || c.outputTokens > 0 || c.cost > 0), removed: [] })
      };
    }

    it('returns cumulative costs when sinceDate is null', async () => {
      const result = await computeCosts('test-session', null, createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'cumulative');
      assert.equal(result.since, null);
      assert.equal(result.costs.length, 1);
      assert.equal(result.costs[0].inputTokens, 300);
    });

    it('returns incremental costs when sinceDate filters entries', async () => {
      // sinceDate is between the two entries — only the 11:00:00 entry should be included
      const result = await computeCosts('test-session', '2026-03-05T10:30:00Z', createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'incremental');
      assert.equal(result.since, '2026-03-05T10:30:00Z');
      assert.equal(result.costs[0].inputTokens, 200);
    });

    it('returns all entries when sinceDate is before all entries', async () => {
      const result = await computeCosts('test-session', '2026-03-05T09:00:00Z', createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'incremental');
      assert.equal(result.costs[0].inputTokens, 300);
    });

    it('handles loadBlockData error gracefully', async () => {
      const failDeps = {
        loadBlockData: async () => { throw new Error('ccusage error'); },
        filterZeroUsageCosts: () => ({ filtered: [], removed: [] })
      };
      const result = await computeCosts('test-session', null, failDeps);
      assert.equal(result.success, false);
      assert.match(result.error, /ccusage error/);
    });

    it('handles empty blocks gracefully', async () => {
      const result = await computeCosts('test-session', null, createTestDeps([]));
      // Empty costs after filtering — success with empty array
      assert.equal(result.success, true);
      assert.deepEqual(result.costs, []);
    });
  });
});
