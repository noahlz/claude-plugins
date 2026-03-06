#!/usr/bin/env node

import * as ccusageOps from './ccusage-operations.js';

/**
 * Aggregate usage entries by model name, summing tokens and cost.
 * @param {Array} entries - Array of usage entries with {model, inputTokens, outputTokens, costUSD}
 * @returns {Array} - [{model, inputTokens, outputTokens, cost}] cost rounded to 2 decimal places
 */
export function aggregateEntriesByModel(entries) {
  const byModel = new Map();

  for (const entry of entries) {
    const key = entry.model || 'unknown';

    if (!byModel.has(key)) {
      byModel.set(key, { model: key, inputTokens: 0, outputTokens: 0, costUSD: 0 });
    }

    const agg = byModel.get(key);
    agg.inputTokens += entry.inputTokens ?? 0;
    agg.outputTokens += entry.outputTokens ?? 0;
    agg.costUSD += entry.costUSD ?? 0;
  }

  return Array.from(byModel.values()).map(({ model, inputTokens, outputTokens, costUSD }) => ({
    model,
    inputTokens,
    outputTokens,
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

    // Flatten blocks[].entries[] into a single array
    const allEntries = blocks.flatMap(block => block.entries ?? []);

    // Filter to entries after sinceDate when provided
    const sinceMs = sinceDate ? new Date(sinceDate).getTime() : null;
    const entries = sinceMs !== null
      ? allEntries.filter(entry => new Date(entry.timestamp).getTime() > sinceMs)
      : allEntries;

    const aggregated = aggregateEntriesByModel(entries);

    const { filtered: costs } = filterZeroUsageCosts(aggregated);

    return {
      success: true,
      method: sinceDate ? 'incremental' : 'cumulative',
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
