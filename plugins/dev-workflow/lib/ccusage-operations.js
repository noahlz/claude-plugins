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
 * This module wraps the ccusage library with a stable API for dev-workflow skills.
 * Filesystem-based session discovery replaces ccusage API calls for better performance.
 *
 * TERMINOLOGY NOTE:
 * ==================
 * ccusage calls a project directory a "session" (keyed by filesystem path, e.g. "-Users-foo-bar").
 * Claude Code calls the same thing a "project" (stored in ~/.claude/projects/).
 * The skill config field `sessionId` is therefore a project path identifier (ccusage terminology),
 * NOT a Claude Code session UUID (which identifies an individual conversation).
 */

/**
 * Load block data for a session from ccusage
 * Direct wrapper around ccusage/data-loader.loadSessionBlockData()
 * @param {string} sessionId - Session ID (project path)
 * @returns {Promise<Array>} Array of block data entries with timestamps
 */
/* node:coverage disable */
export async function loadBlockData(sessionId) {
  const { loadSessionBlockData } = await import('ccusage/data-loader');
  return await loadSessionBlockData({ project: sessionId });
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
 * Check if a cost entry has any non-zero usage
 * @param {object} cost - Cost object
 * @returns {boolean}
 */
function hasUsage(cost) {
  return (typeof cost.inputTokens === 'number' && cost.inputTokens > 0)
    || (typeof cost.outputTokens === 'number' && cost.outputTokens > 0)
    || (typeof cost.cost === 'number' && cost.cost > 0);
}

/**
 * Filter out cost entries with zero usage (no tokens and no cost)
 * @param {Array} costsArray - Array of cost objects
 * @returns {Object} - { filtered, removed }
 */
export function filterZeroUsageCosts(costsArray) {
  if (!Array.isArray(costsArray)) {
    return { filtered: [], removed: [] };
  }

  const filtered = [];
  const removed = [];

  for (const cost of costsArray) {
    if (hasUsage(cost)) {
      filtered.push(cost);
    } else {
      removed.push(cost);
    }
  }

  return { filtered, removed };
}

/**
 * Get the cleanup period in days from Claude settings.
 * Reads cleanupPeriodDays from ~/.claude/settings.json, with project-level
 * .claude/settings.json taking precedence. Defaults to 30 if unset or unparseable.
 * @returns {number} - Cleanup period in days
 */
export function getCleanupPeriodDays() {
  const DEFAULT_DAYS = 30;

  const settingsFiles = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join('.claude', 'settings.json')
  ];

  let result = DEFAULT_DAYS;

  for (const filePath of settingsFiles) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const value = parsed.cleanupPeriodDays;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        result = value;
      }
    } catch {
      // File missing or unparseable — skip
    }
  }

  return result;
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
    if (!hasUsage(cost)) {
      return false;
    }
  }

  return true;
}
