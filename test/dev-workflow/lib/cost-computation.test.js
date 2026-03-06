import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCosts, aggregateEntriesByModel } from '../../../plugins/dev-workflow/lib/cost-computation.js';

describe('lib/cost-computation.js', () => {
  describe('aggregateEntriesByModel', () => {
    it('aggregates entries by model name', () => {
      const entries = [
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 1000, cacheReadInputTokens: 500 }, costUSD: 0.10 },
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100, cacheCreationInputTokens: 2000, cacheReadInputTokens: 1000 }, costUSD: 0.20 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result.length, 1);
      assert.equal(result[0].model, 'claude-sonnet-4-6');
      assert.equal(result[0].in, 300);
      assert.equal(result[0].out, 150);
      assert.equal(result[0].cacheWrites, '3k');
      assert.equal(result[0].cacheReads, '2k');
      assert.equal(result[0].cost, 0.30);
    });

    it('keeps different models separate', () => {
      const entries = [
        { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }, costUSD: 0.10 },
        { model: 'claude-haiku-4-5', usage: { inputTokens: 500, outputTokens: 200, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }, costUSD: 0.02 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result.length, 2);
      const sonnet = result.find(r => r.model === 'claude-sonnet-4-6');
      const haiku = result.find(r => r.model === 'claude-haiku-4-5');
      assert.ok(sonnet, 'Should have sonnet entry');
      assert.equal(sonnet.in, 100);
      assert.ok(haiku, 'Should have haiku entry');
      assert.equal(haiku.in, 500);
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

    it('defaults cache token fields to 0 when absent from entry.usage', () => {
      const entries = [
        { model: 'test', usage: { inputTokens: 10, outputTokens: 5 }, costUSD: 0.01 }
      ];
      const result = aggregateEntriesByModel(entries);
      assert.equal(result[0].cacheWrites, 0);
      assert.equal(result[0].cacheReads, 0);
    });

    it('handles empty array', () => {
      const result = aggregateEntriesByModel([]);
      assert.deepEqual(result, []);
    });
  });

  describe('computeCosts', () => {
    const mockEntries = [
      { model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 500, cacheReadInputTokens: 1000 }, costUSD: 0.10, timestamp: '2026-03-05T10:00:00Z' },
      { model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100, cacheCreationInputTokens: 1000, cacheReadInputTokens: 2000 }, costUSD: 0.20, timestamp: '2026-03-05T11:00:00Z' }
    ];

    const mockBlocks = [{ entries: mockEntries }];

    function createTestDeps(blocks = mockBlocks) {
      return {
        loadBlockData: async () => blocks,
        // Identity passthrough — filterZeroUsageCosts behavior is tested separately
        filterZeroUsageCosts: (costs) => ({ filtered: costs, removed: [] })
      };
    }

    it('returns cumulative costs when sinceDate is null', async () => {
      const result = await computeCosts('test-session', null, createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'cum');
      assert.equal(result.since, null);
      assert.equal(result.costs.length, 1);
      assert.equal(result.costs[0].in, 300);
    });

    it('returns incremental costs when sinceDate filters entries', async () => {
      // sinceDate is between the two entries — only the 11:00:00 entry should be included
      const result = await computeCosts('test-session', '2026-03-05T10:30:00Z', createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'inc');
      assert.equal(result.since, '2026-03-05T10:30:00Z');
      assert.equal(result.costs[0].in, 200);
    });

    it('returns all entries when sinceDate is before all entries', async () => {
      const result = await computeCosts('test-session', '2026-03-05T09:00:00Z', createTestDeps());
      assert.equal(result.success, true);
      assert.equal(result.method, 'inc');
      assert.equal(result.costs[0].in, 300);
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
