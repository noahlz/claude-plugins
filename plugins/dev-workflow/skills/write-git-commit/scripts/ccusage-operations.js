#!/usr/bin/env node

/**
 * ccusage-operations.js
 * Abstraction layer for all ccusage operations
 *
 * ARCHITECTURE NOTES:
 * ==================
 * This module wraps the ccusage library with a stable API for the write-git-commit skill.
 *
 * Key Decision: Always use loadSessionData() + filter pattern instead of ccusage's
 * loadSessionUsageById(), because:
 * - ccusage's loadSessionUsageById() expects sessions to be stored as single {sessionId}.jsonl
 *   files in a flat directory structure
 * - Claude Code stores sessions in directories: projects/{sessionId}/{uuid}.jsonl (multiple
 *   files per session that get aggregated)
 * - loadSessionData() correctly handles Claude Code's directory structure by aggregating all
 *   session files, so we filter its results to get individual sessions
 *
 * This approach is efficient because:
 * - Sessions are typically 5-10 in number for most users
 * - loadSessionData() is fast and already fully loaded in memory
 * - Linear search/filter is negligible compared to I/O
 * - Provides a consistent, documented, working pattern across the module
 */

/**
 * Load all sessions from ccusage
 * Direct wrapper around ccusage/data-loader.loadSessionData()
 * @returns {Promise<Array>} Array of session objects
 */
export async function loadSessionData() {
  const { loadSessionData: load } = await import('ccusage/data-loader');
  return await load();
}

/**
 * Verify if a session exists
 * @param {string} sessionId - Session ID to verify
 * @returns {Promise<{success: boolean, exists: boolean, error?: string}>}
 */
export async function verifySession(sessionId) {
  try {
    const sessions = await loadSessionData();
    const session = sessions.find(s => s.sessionId === sessionId);
    return {
      success: true,
      exists: session !== null
    };
  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error.message
    };
  }
}

/**
 * Get session costs with extraction and validation
 * Fetches all sessions via loadSessionData() and filters for the target session.
 * Note: We use loadSessionData() because ccusage's loadSessionUsageById() doesn't work
 * with Claude Code's session storage structure (it expects {sessionId}.jsonl files,
 * but Claude Code stores sessions in project/{sessionId}/ directories with multiple files).
 * @param {string} sessionId - Session ID
 * @returns {Promise<{success: boolean, costs: Array, error?: string}>}
 */
export async function getSessionCosts(sessionId) {
  try {
    const sessions = await loadSessionData();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return {
        success: false,
        costs: [],
        error: `Session '${sessionId}' not found`
      };
    }

    const costs = extractCostMetrics(session);

    if (costs.length === 0) {
      return {
        success: false,
        costs: [],
        error: `No model breakdowns found for session '${sessionId}'`
      };
    }

    return {
      success: true,
      costs
    };
  } catch (error) {
    return {
      success: false,
      costs: [],
      error: error.message
    };
  }
}

/**
 * List all sessions sorted by lastActivity descending
 * @returns {Promise<{status: string, data: {sessions: Array}, error?: string}>}
 */
export async function listSessions() {
  try {
    const sessions = await loadSessionData();

    const sortedSessions = sessions
      .map(s => ({
        sessionId: s.sessionId,
        lastActivity: s.lastActivity || ''
      }))
      .sort((a, b) => {
        const dateA = a.lastActivity || '';
        const dateB = b.lastActivity || '';
        return dateB.localeCompare(dateA);
      });

    return {
      status: 'success',
      data: { sessions: sortedSessions }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { sessions: [] },
      error: `Failed to list sessions: ${error.message}`
    };
  }
}

/**
 * Convert a directory path to session ID format
 * Example: /Users/foo/bar -> -Users-foo-bar
 * @param {string} dirPath - Directory path
 * @returns {string} - Session ID
 */
export function pwdToSessionId(dirPath) {
  const normalized = dirPath.replace(/^\//, '').replace(/\//g, '-');
  return `-${normalized}`;
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
