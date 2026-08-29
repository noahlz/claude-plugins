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
 *
 * Internally, ccusage globs **\/*.jsonl recursively under the session directory, which includes
 * both top-level conversation files and nested subagent files (<uuid>/subagents/agent-*.jsonl).
 * Duplicate entries (same API call echoed in parent and subagent files) are deduplicated by
 * messageId:requestId hash before being returned. No extra filtering is needed here.
 *
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
 * Check whether a directory name is a Claude Code project (session) directory.
 * Unix dirs are path-encoded with a leading dash (e.g. "-Users-foo-bar").
 * Windows dirs start with a drive letter (e.g. "C--Users-foo-bar").
 * @param {string} name - Directory name
 * @returns {boolean}
 */
export function isProjectDirName(name) {
  return name.startsWith('-') || /^[A-Za-z]-/.test(name);
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
      .filter(entry => entry.isDirectory() && isProjectDirName(entry.name))
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
 *
 * Because each git worktree has a unique absolute path, worktrees automatically get
 * distinct session IDs (e.g. -Users-foo-project--claude-worktrees-feature-x).
 * Concurrent Claude sessions in different worktrees therefore never share cost data.
 *
 * @param {string} dirPath - Directory path
 * @returns {string} - Session ID
 */
export function pwdToSessionId(dirPath) {
  // Claude Code encodes a project path by replacing every non-alphanumeric character with a
  // dash, not just separators: "/repo/.claude/worktrees/x" becomes "-repo--claude-worktrees-x".
  // Dropping the dot would miss every worktree living under a dot-directory.
  const encode = (segment) => segment.replace(/[^A-Za-z0-9]/g, '-');

  // Windows: C:\Users\foo -> C--Users-foo (drive letter; no leading dash)
  if (/^[A-Za-z]:/.test(dirPath)) {
    return encode(dirPath);
  }
  // Unix: /Users/foo -> -Users-foo
  return `-${encode(dirPath.replace(/^\//, ''))}`;
}

/**
 * Check if a cost entry has any non-zero usage
 * @param {object} cost - Cost object
 * @returns {boolean}
 */
function hasUsage(cost) {
  return (typeof cost.in === 'number' && cost.in > 0)
    || (typeof cost.out === 'number' && cost.out > 0)
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

/**
 * Check whether a project session directory holds any usage transcripts.
 *
 * A project directory can exist while being empty: Claude Code discards a worktree's
 * transcripts when the worktree is removed, leaving the directory behind. Testing for
 * the directory alone would report cost data that ccusage cannot actually load.
 *
 * @param {string} sessionId - Session ID (project path)
 * @returns {boolean}
 */
export function hasSessionData(sessionId) {
  try {
    const entries = fs.readdirSync(path.join(getProjectsDir(), sessionId), { recursive: true });
    return entries.some(entry => String(entry).endsWith('.jsonl'));
  } catch {
    return false;
  }
}

/**
 * Resolve the project session ID that recorded a worktree branch's usage.
 *
 * A live worktree gives its path directly. A removed worktree does not, so its session is
 * recovered by name: worktree session IDs are the repository's own session ID followed by
 * the encoded worktree subpath, which ends in the branch name (e.g.
 * "-Users-me-proj--claude-worktrees-003-derived" for branch "003-derived"). Matching on that
 * suffix covers any worktree root convention (.claude/worktrees, .worktrees, and so on).
 *
 * @param {string} repoRoot - Absolute path of the main working tree
 * @param {string} branch - Branch name
 * @param {string|null} worktreePath - Absolute path of the live worktree, if it still exists
 * @returns {{sessionId: string|null, hasData: boolean, resolvedBy: string}}
 */
export function findWorktreeSessionId(repoRoot, branch, worktreePath = null) {
  if (worktreePath) {
    const sessionId = pwdToSessionId(path.resolve(worktreePath));
    return { sessionId, hasData: hasSessionData(sessionId), resolvedBy: 'worktree' };
  }

  const repoSessionId = pwdToSessionId(path.resolve(repoRoot));
  const branchSuffix = `-${branch.replace(/\//g, '-')}`;
  const projectsDir = getProjectsDir();

  let candidates = [];
  try {
    candidates = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => name.startsWith(`${repoSessionId}-`) && name.endsWith(branchSuffix));
  } catch {
    return { sessionId: null, hasData: false, resolvedBy: 'none' };
  }

  // Prefer a match that still holds transcripts; fall back to the most recently touched one
  // so the caller can report the session it found and that its data is gone.
  const withData = candidates.filter(hasSessionData);
  const pool = withData.length > 0 ? withData : candidates;

  if (pool.length === 0) {
    return { sessionId: null, hasData: false, resolvedBy: 'none' };
  }

  const sessionId = pool
    .map(name => ({ name, mtime: fs.statSync(path.join(projectsDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].name;

  return { sessionId, hasData: withData.length > 0, resolvedBy: 'branch-name' };
}
