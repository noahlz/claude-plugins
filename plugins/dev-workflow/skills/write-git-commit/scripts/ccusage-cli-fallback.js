#!/usr/bin/env node

import { execSync } from 'child_process';

/**
 * Load all session data via ccusage CLI
 * Fallback for when library import fails
 * @returns {Promise<Array>} - Array of session objects
 * @throws {Error} - If CLI fails or ccusage not available
 */
export async function loadSessionDataCli() {
  try {
    const output = execSync('ccusage session --json', { encoding: 'utf-8' });
    let sessions = JSON.parse(output);

    // Handle both direct array and wrapped { sessions: [...] } format
    if (sessions.sessions && Array.isArray(sessions.sessions)) {
      sessions = sessions.sessions;
    }

    if (!Array.isArray(sessions)) {
      throw new Error('Expected array of sessions from ccusage CLI');
    }

    return sessions;
  } catch (error) {
    // Check for various "command not found" error patterns
    const errorMsg = error.message || '';
    if (error.code === 'ENOENT' ||
        errorMsg.includes('not found') ||
        errorMsg.includes('ENOENT') ||
        errorMsg.includes('command not found')) {
      throw new Error('ccusage CLI not found - install with: npm install -g ccusage');
    }
    throw new Error(`Failed to load sessions via CLI: ${error.message}`);
  }
}

/**
 * Load a specific session by ID via CLI
 * @param {string} sessionId - Session ID to load
 * @returns {Promise<Object|null>} - Session object or null if not found
 */
export async function loadSessionByIdCli(sessionId) {
  try {
    const sessions = await loadSessionDataCli();
    const session = sessions.find(s => s.sessionId === sessionId);
    return session || null;
  } catch (error) {
    throw new Error(`Failed to load session ${sessionId} via CLI: ${error.message}`);
  }
}

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
