#!/usr/bin/env node

import * as ccusageOps from './ccusage-operations.js';

/**
 * Abbreviate a token count to a compact string (e.g. 213097 → "213k").
 * Values under 1000 are returned as-is (number). Cache counts are informational only.
 * @param {number} count
 * @returns {string|number}
 */
function abbreviateTokens(count) {
  if (count >= 1000) return `${Math.round(count / 1000)}k`;
  return count;
}

/**
 * Aggregate usage entries by model name, summing tokens and cost.
 * Deduplication of entries (same API call appearing in both parent and subagent JSONL files)
 * is handled upstream by ccusage's loadSessionBlockData via messageId:requestId hashing,
 * so entries here are already unique.
 * @param {Array} entries - Array of usage entries with {model, inputTokens, outputTokens, costUSD}
 * @returns {Array} - [{model, in, out, cacheWrites, cacheReads, cost}] cost rounded to 2 decimal places;
 *   cacheWrites/cacheReads are abbreviated strings (e.g. "213k") for compactness — informational only
 */
export function aggregateEntriesByModel(entries) {
  const byModel = new Map();

  for (const entry of entries) {
    const key = entry.model || 'unknown';

    if (!byModel.has(key)) {
      byModel.set(key, { model: key, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, costUSD: 0 });
    }

    const agg = byModel.get(key);
    // Token counts are nested under entry.usage; costUSD is at the top level
    agg.inputTokens += entry.usage?.inputTokens ?? 0;
    agg.outputTokens += entry.usage?.outputTokens ?? 0;
    agg.cacheWriteTokens += entry.usage?.cacheCreationInputTokens ?? 0;
    agg.cacheReadTokens += entry.usage?.cacheReadInputTokens ?? 0;
    agg.costUSD += entry.costUSD ?? 0;
  }

  return Array.from(byModel.values()).map(({ model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, costUSD }) => ({
    model,
    in: inputTokens,
    out: outputTokens,
    cacheWrites: abbreviateTokens(cacheWriteTokens),
    cacheReads: abbreviateTokens(cacheReadTokens),
    cost: Math.round(costUSD * 100) / 100
  }));
}

/**
 * Compute costs for a project session, optionally filtered to entries after sinceDate.
 * Uses ccusage's loadSessionBlockData for pricing calculation.
 *
 * @param {string} sessionId - Project session ID (e.g. "-Users-noahlz-projects-foo")
 * @param {string|null} sinceDate - ISO 8601 cutoff (null = all entries = cumulative mode)
 * @param {object} deps - { loadBlockData, filterZeroUsageCosts } for DI/testing
 * @returns {Promise<{success: boolean, method: string, since: string|null, costs: Array, error?: string}>}
 */
export async function computeCosts(sessionId, sinceDate, deps = {}) {
  const { loadBlockData, filterZeroUsageCosts } = { ...createDefaultDeps(), ...deps };

  try {
    const blocks = await loadBlockData(sessionId);

    // Flatten blocks[].entries[] into a single array.
    // Subagent usage (nested under <session-uuid>/subagents/) is included automatically
    // by ccusage's recursive glob; duplicates are removed by messageId:requestId before this point.
    const allEntries = blocks.flatMap(block => block.entries ?? []);

    // Incremental mode: filter to entries after sinceDate (the commit date of the last
    // Claude-Cost-Metrics trailer matching this sessionId, from getLastCostCommitDate).
    // Cumulative mode: sinceDate is null, all entries are included.
    const sinceMs = sinceDate ? new Date(sinceDate).getTime() : null;
    const entries = sinceMs !== null
      ? allEntries.filter(entry => new Date(entry.timestamp).getTime() > sinceMs)
      : allEntries;

    const aggregated = aggregateEntriesByModel(entries);

    const { filtered: costs } = filterZeroUsageCosts(aggregated);

    return {
      success: true,
      method: sinceDate ? 'inc' : 'cum',
      since: sinceDate,
      costs
    };
  } catch (error) {
    return {
      success: false,
      method: 'error',
      since: null,
      costs: [],
      error: error.message
    };
  }
}

/**
 * Create default dependency implementations backed by ccusage-operations.
 * @returns {{ loadBlockData: Function, filterZeroUsageCosts: Function }}
 */
export function createDefaultDeps() {
  return {
    loadBlockData: ccusageOps.loadBlockData,
    filterZeroUsageCosts: ccusageOps.filterZeroUsageCosts
  };
}
