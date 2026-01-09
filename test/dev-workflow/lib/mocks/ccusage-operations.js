/**
 * Mock ccusage operations for testing
 * Mirrors the production API but returns mock data without requiring ccusage library
 */

import path from 'path';
import os from 'os';

let mockSessions = [
  {
    sessionId: '-Users-noahlz-projects-claude-plugins',
    lastActivity: '2025-01-15',
    modelBreakdowns: [
      {
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 0,
        cost: 0.45
      },
      {
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 10,
        cost: 1.25
      }
    ]
  }
];

/**
 * Set mock session data (for test setup)
 * @param {Array} sessions - Array of mock session objects
 */
export function setMockSessions(sessions) {
  mockSessions = sessions;
}

/**
 * Reset to default mock data
 */
export function resetMockSessions() {
  mockSessions = [
    {
      sessionId: '-Users-noahlz-projects-claude-plugins',
      lastActivity: '2025-01-15',
      modelBreakdowns: [
        {
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 0,
          cost: 0.45
        }
      ]
    }
  ];
}

export async function loadSessionUsageById(sessionId) {
  return mockSessions.find(s => s.sessionId === sessionId) || null;
}

export async function loadSessionData() {
  return mockSessions;
}

export async function getSessionCosts(sessionId) {
  try {
    const session = await loadSessionUsageById(sessionId);

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
 * Get the Claude projects directory path
 * @returns {string} - Path to ~/.claude/projects
 */
export function getProjectsDir() {
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * List all local project sessions from filesystem
 * Uses directory mtime for sorting, doesn't read .jsonl contents
 * @returns {{status: string, data: {sessions: Array}, error?: string}}
 */
export function listLocalSessions() {
  try {
    // In tests, return sorted mock sessions with lastActivity
    const sortedSessions = mockSessions
      .map(s => ({
        sessionId: s.sessionId,
        lastActivity: s.lastActivity || ''
      }))
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

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
 * Find recommended session ID based on current working directory
 * @param {string} cwd - Current working directory
 * @returns {{sessionId: string | null, match: boolean}}
 */
export function findRecommendedSession(cwd) {
  const calculatedId = pwdToSessionId(cwd);
  const exists = mockSessions.some(s => s.sessionId === calculatedId);

  return {
    sessionId: exists ? calculatedId : null,
    match: exists
  };
}

export function pwdToSessionId(dirPath) {
  const normalized = dirPath.replace(/^\//, '').replace(/\//g, '-');
  return `-${normalized}`;
}

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

export function validateCostMetrics(costsArray) {
  if (!Array.isArray(costsArray) || costsArray.length === 0) {
    return false;
  }

  for (const cost of costsArray) {
    if (!cost.model || typeof cost.cost !== 'number') {
      return false;
    }

    const hasInputTokens = typeof cost.inputTokens === 'number' && cost.inputTokens > 0;
    const hasOutputTokens = typeof cost.outputTokens === 'number' && cost.outputTokens > 0;
    const hasCost = cost.cost > 0;

    if (!hasInputTokens && !hasOutputTokens && !hasCost) {
      return false;
    }
  }

  return true;
}
