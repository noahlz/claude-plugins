#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * ccusage-operations.js
 * Abstraction layer for all ccusage operations
 *
 * ARCHITECTURE NOTES:
 * ==================
 * This module wraps the ccusage library with a stable API for the write-git-commit skill.
 * Filesystem-based session discovery replaces ccusage API calls for better performance.
 */

/**
 * Load all sessions from ccusage
 * Direct wrapper around ccusage/data-loader.loadSessionData()
 * @returns {Promise<Array>} Array of session objects
 */
/* node:coverage disable */
export async function loadSessionData() {
  const { loadSessionData: load } = await import('ccusage/data-loader');
  return await load();
}
/* node:coverage enable */

/**
 * Get the Claude projects directory path
 * @returns {string} - Path to ~/.claude/projects
 */
export function getProjectsDir() {
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Get session costs with extraction and validation
 * Fetches all sessions via loadSessionData() and filters for the target session.
 * Note: We use loadSessionData() because ccusage's loadSessionUsageById() doesn't work
 * with Claude Code's session storage structure (it expects {sessionId}.jsonl files,
 * but Claude Code stores sessions in project/{sessionId}/ directories with multiple files).
 * @param {string} sessionId - Session ID
 * @param {Object} deps - Dependencies for testing
 * @param {Function} deps.loadSessionData - Function to load session data
 * @returns {Promise<{success: boolean, costs: Array, error?: string}>}
 */
export async function getSessionCosts(sessionId, deps = {}) {
  const loadData = deps.loadSessionData || loadSessionData;

  try {
    const sessions = await loadData();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return {
        success: false,
        costs: [],
        error: `Session '${sessionId}' not found`
      };
    }

    // Find subagent sessions and aggregate costs
    const subagentSessions = findSubagentSessions(sessions, sessionId);
    const allSessions = [session, ...subagentSessions];
    const costs = aggregateModelBreakdowns(allSessions);

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
 * List all local project sessions from filesystem
 * Uses directory mtime for sorting, doesn't read .jsonl contents
 * @returns {{status: string, data: {sessions: Array}, error?: string}}
 */
export function listLocalSessions() {
  try {
    const projectsDir = getProjectsDir();

    if (!fs.existsSync(projectsDir)) {
      return {
        status: 'success',
        data: { sessions: [] }
      };
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

    const sessions = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('-'))
      .map(entry => {
        const dirPath = path.join(projectsDir, entry.name);
        const stats = fs.statSync(dirPath);
        return {
          sessionId: entry.name,
          lastActivity: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

    return {
      status: 'success',
      data: { sessions }
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
 * Find recommended session ID based on current working directory
 * @param {string} cwd - Current working directory
 * @returns {{sessionId: string | null, match: boolean}}
 */
export function findRecommendedSession(cwd) {
  const calculatedId = pwdToSessionId(path.resolve(cwd));
  const projectsDir = getProjectsDir();
  const sessionPath = path.join(projectsDir, calculatedId);

  const exists = fs.existsSync(sessionPath);

  return {
    sessionId: exists ? calculatedId : null,
    match: exists
  };
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
 * Find subagent sessions belonging to a main session
 * Subagents have sessionId "subagents" and projectPath starting with mainSessionId/
 * @param {Array} sessions - All sessions from ccusage
 * @param {string} mainSessionId - The main session ID
 * @returns {Array} - Array of subagent session objects
 */
export function findSubagentSessions(sessions, mainSessionId) {
  return sessions.filter(s =>
    s.sessionId === 'subagents' &&
    s.projectPath &&
    s.projectPath.startsWith(mainSessionId + '/')
  );
}

/**
 * Aggregate model breakdowns from multiple sessions
 * Sums tokens and costs by model name
 * @param {Array} sessionsList - Array of session objects
 * @returns {Array} - Aggregated cost metrics by model
 */
export function aggregateModelBreakdowns(sessionsList) {
  const aggregated = new Map();

  for (const session of sessionsList) {
    for (const m of session.modelBreakdowns || []) {
      const model = m.model || m.modelName || 'unknown';
      const existing = aggregated.get(model) || { model, inputTokens: 0, outputTokens: 0, cost: 0 };
      existing.inputTokens += m.inputTokens || 0;
      existing.outputTokens += m.outputTokens || 0;
      existing.cost += m.cost || 0;
      aggregated.set(model, existing);
    }
  }

  return Array.from(aggregated.values()).map(c => ({
    ...c,
    cost: Math.round(c.cost * 100) / 100
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
