#!/usr/bin/env node

/**
 * Extract cost metrics from a session object
 * Transforms modelBreakdowns to standard cost format
 * @param {Object} session - Session object from ccusage
 * @returns {Array} - Array of cost objects with model, inputTokens, outputTokens, cost
 */
export function extractCostMetrics(session) {
  if (!session || !session.modelBreakdowns || !Array.isArray(session.modelBreakdowns)) {
    return [];
  }

  return session.modelBreakdowns.map(m => ({
    model: m.model || m.modelName || 'unknown',
    inputTokens: m.inputTokens || 0,
    outputTokens: m.outputTokens || 0,
    cost: Math.round((m.cost || 0) * 100) / 100
  }));
}

/**
 * Validate that cost metrics are real and complete
 * Rejects empty arrays, all-zero costs, missing fields, or invalid data
 * @param {Array} costsArray - Array of cost objects to validate
 * @returns {boolean} - true if metrics are valid, false otherwise
 */
export function validateCostMetrics(costsArray) {
  // Must be non-empty array
  if (!Array.isArray(costsArray) || costsArray.length === 0) {
    return false;
  }

  // Check each cost object
  for (const cost of costsArray) {
    // Must have required fields
    if (!cost.model || typeof cost.cost !== 'number') {
      return false;
    }

    // Must have at least one token or cost value
    const hasInputTokens = typeof cost.inputTokens === 'number' && cost.inputTokens > 0;
    const hasOutputTokens = typeof cost.outputTokens === 'number' && cost.outputTokens > 0;
    const hasCost = cost.cost > 0;

    if (!hasInputTokens && !hasOutputTokens && !hasCost) {
      return false;
    }
  }

  return true;
}
