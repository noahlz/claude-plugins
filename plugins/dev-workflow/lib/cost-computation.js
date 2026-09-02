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
 * Sum usage entries by model, keeping every field numeric.
 * Deduplication of entries (same API call appearing in both parent and subagent JSONL files)
 * is handled upstream by ccusage's loadSessionBlockData via messageId:requestId hashing,
 * so entries here are already unique.
 *
 * Kept separate from abbreviation so entries pooled from several sessions can be summed
 * once at full precision — adding pre-abbreviated cache strings would lose it.
 *
 * @param {Array} entries - Usage entries with {model, usage:{...}, costUSD}
 * @returns {Array} - [{model, cost, in, out, cacheWrites, cacheReads}] all numeric, cost unrounded
 */
export function sumEntriesByModel(entries) {
  const byModel = new Map();

  for (const entry of entries) {
    const key = entry.model || 'unknown';

    if (!byModel.has(key)) {
      byModel.set(key, { model: key, cost: 0, in: 0, out: 0, cacheWrites: 0, cacheReads: 0 });
    }

    const agg = byModel.get(key);
    // Token counts are nested under entry.usage; costUSD is at the top level
    agg.in += entry.usage?.inputTokens ?? 0;
    agg.out += entry.usage?.outputTokens ?? 0;
    agg.cacheWrites += entry.usage?.cacheCreationInputTokens ?? 0;
    agg.cacheReads += entry.usage?.cacheReadInputTokens ?? 0;
    agg.cost += entry.costUSD ?? 0;
  }

  return Array.from(byModel.values());
}

/**
 * Round costs and compact cache token counts for display and trailer embedding.
 * @param {Array} rows - Numeric rows from sumEntriesByModel
 * @returns {Array} - cost rounded to 2 decimals; cacheWrites/cacheReads abbreviated
 */
export function abbreviateCostRows(rows) {
  return rows.map(({ model, cost, in: inTokens, out, cacheWrites, cacheReads }) => ({
    model,
    cost: Math.round(cost * 100) / 100,
    in: inTokens,
    out,
    cacheWrites: abbreviateTokens(cacheWrites),
    cacheReads: abbreviateTokens(cacheReads)
  }));
}

/**
 * Aggregate usage entries by model name, summing tokens and cost.
 * @param {Array} entries - Array of usage entries
 * @returns {Array} - [{model, cost, in, out, cacheWrites, cacheReads}] cost rounded to 2 decimal
 *   places; cacheWrites/cacheReads are abbreviated strings (e.g. "213k") — informational only
 */
export function aggregateEntriesByModel(entries) {
  return abbreviateCostRows(sumEntriesByModel(entries));
}

/**
 * Load a session's usage entries, optionally dropping everything at or before sinceDate.
 * @param {Function} loadBlockData
 * @param {string} sessionId
 * @param {string|null} sinceDate - ISO 8601 cutoff (null = all entries)
 * @returns {Promise<Array>}
 */
async function collectEntries(loadBlockData, sessionId, sinceDate) {
  const blocks = await loadBlockData(sessionId);

  // Subagent usage (nested under <session-uuid>/subagents/) is included automatically
  // by ccusage's recursive glob; duplicates are removed by messageId:requestId before this point.
  const allEntries = blocks.flatMap(block => block.entries ?? []);

  if (!sinceDate) return allEntries;

  const sinceMs = new Date(sinceDate).getTime();
  return allEntries.filter(entry => new Date(entry.timestamp).getTime() > sinceMs);
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
    // Incremental mode: sinceDate is the commit date of the last Claude-Cost-Metrics trailer
    // matching this sessionId (from getLastCostCommitDate). Cumulative mode: sinceDate is null.
    const entries = await collectEntries(loadBlockData, sessionId, sinceDate);

    const { filtered: costs } = filterZeroUsageCosts(aggregateEntriesByModel(entries));

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
