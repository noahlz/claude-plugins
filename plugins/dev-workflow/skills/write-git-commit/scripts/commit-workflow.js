#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { detectPluginRoot } from '../../lib/common.js';
import { parseJsonFile } from '../../lib/config-loader.js';
import { loadSessionConfig } from './load-config.js';
import { verifySession } from './verify-session.js';
import { getSessionCosts } from './claude-session-cost.js';
import { ensureCcusageInstalled } from './ccusage-utils.js';

/**
 * Check if config file exists and is valid
 * @param {string} baseDir - Base directory (defaults to current dir)
 * @returns {object} - { status, data, message }
 */
function checkConfig(baseDir = '.') {
  const configPath = path.join(baseDir, '.claude/settings.plugins.write-git-commit.json');

  // Check if config file exists
  if (!fs.existsSync(configPath)) {
    return {
      status: 'not_found',
      data: {},
      message: `Configuration file not found: ${configPath}`
    };
  }

  // Check if file is empty
  if (fs.statSync(configPath).size === 0) {
    return {
      status: 'empty',
      data: {},
      message: `Configuration file is empty: ${configPath}`
    };
  }

  // Try to parse as JSON
  try {
    const config = parseJsonFile(configPath);
    return {
      status: 'found',
      data: { config },
      message: 'Configuration file exists and is valid'
    };
  } catch (error) {
    return {
      status: 'invalid',
      data: {},
      message: `Configuration file is not valid JSON: ${configPath}`
    };
  }
}

/**
 * Prepare for commit: load config, verify session, get costs
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {string} options.pluginRoot - Plugin root
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepare(options = {}) {
  const { baseDir = '.', pluginRoot } = options;

  try {
    // Ensure ccusage is installed
    await ensureCcusageInstalled(pluginRoot);

    // Load session config
    const config = loadSessionConfig({ baseDir });

    if (config.errors.length > 0) {
      return {
        status: 'error',
        data: {},
        message: config.errors.join('; ')
      };
    }

    const sessionId = config.sessionId;

    // Verify session exists
    const verification = await verifySession(sessionId, pluginRoot);

    if (verification.status !== 'verified') {
      return {
        status: 'error',
        data: {},
        message: `Session ID not found: ${sessionId}. Check ccusage session --json for available sessions.`
      };
    }

    // If config exists and session was not auto-detected, get costs and return success
    if (config.configExists && !config.autoDetected) {
      // Get current session costs
      const costs = await getSessionCosts(sessionId, pluginRoot);

      return {
        status: 'success',
        data: {
          session_id: sessionId,
          current_cost: costs
        },
        message: 'Session verified and costs fetched'
      };
    }

    // No config exists or only auto-detected - load available sessions and present list
    const { loadSessionData } = await import('ccusage/data-loader');
    const allSessions = await loadSessionData();

    if (!allSessions || allSessions.length === 0) {
      return {
        status: 'error',
        data: {},
        message: 'No sessions found in ccusage data'
      };
    }

    // Get session IDs
    const sessionIds = allSessions.map(s => s.sessionId);

    // Compute recommended session from the directory where Claude Code was invoked
    const { pwdToSessionId } = await import('./ccusage-utils.js');
    const recommendedId = pwdToSessionId(process.cwd());

    // Check if recommended matches any available session
    const hasRecommended = sessionIds.includes(recommendedId);

    // Sort sessions with recommended first
    let sortedIds = sessionIds;
    if (hasRecommended) {
      sortedIds = [recommendedId, ...sessionIds.filter(id => id !== recommendedId)];
    }

    return {
      status: 'select_session',
      data: {
        sessions: sortedIds,
        recommended_index: hasRecommended ? 0 : null,
        recommended_id: hasRecommended ? recommendedId : null
      },
      message: 'Select a session to use'
    };
  } catch (error) {
    return {
      status: 'error',
      data: {},
      message: error.message
    };
  }
}

/**
 * Read stdin for commit message
 * @returns {Promise<{subject: string, body: string}>}
 */
async function readCommitMessage() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const message = Buffer.concat(chunks).toString('utf8').trim();
  const lines = message.split('\n');

  const subject = lines[0] || '';
  let body = '';

  // Skip first blank line (separator between subject and body)
  let bodyStartIdx = 1;
  if (lines[1] === '') {
    bodyStartIdx = 2;
  }

  if (lines.length > bodyStartIdx) {
    body = lines.slice(bodyStartIdx).join('\n').trim();
  }

  return { subject, body };
}

/**
 * Create a git commit with cost metrics footer
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {string} options.pluginRoot - Plugin root
 * @returns {Promise<object>} - { status, data, message }
 */
async function commit(options = {}) {
  const { baseDir = '.', pluginRoot } = options;

  try {
    // Read commit message from stdin
    const { subject, body } = await readCommitMessage();

    if (!subject) {
      return {
        status: 'error',
        data: {},
        message: 'Missing commit subject (first line of stdin)'
      };
    }

    // Ensure ccusage is installed
    await ensureCcusageInstalled(pluginRoot);

    // Load session config
    let sessionId = process.env.SESSION_ID;
    let currentCost = process.env.CURRENT_COST;

    if (!sessionId) {
      const config = loadSessionConfig({ baseDir });
      if (config.errors.length > 0) {
        return {
          status: 'error',
          data: {},
          message: `Failed to load config: ${config.errors.join('; ')}`
        };
      }
      sessionId = config.sessionId;
    }

    if (!currentCost) {
      // Verify session and fetch costs
      const verification = await verifySession(sessionId, pluginRoot);
      if (verification.status !== 'verified') {
        return {
          status: 'error',
          data: {},
          message: `Session verification failed: ${verification.message}`
        };
      }

      const costs = await getSessionCosts(sessionId, pluginRoot);
      currentCost = costs;
    } else {
      // Parse if it's a string
      if (typeof currentCost === 'string') {
        try {
          currentCost = JSON.parse(currentCost);
        } catch {
          currentCost = JSON.parse(currentCost);
        }
      }
    }

    // Build cost footer JSON (single line, no pretty-print)
    const costFooter = JSON.stringify({
      sessionId,
      cost: Array.isArray(currentCost) ? currentCost : [currentCost]
    });

    // Build full commit message with git trailer format
    let fullMessage;
    if (body) {
      fullMessage = `${subject}\n\n${body}\n\nCo-Authored-By: 🤖 Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: ${costFooter}`;
    } else {
      fullMessage = `${subject}\n\nCo-Authored-By: 🤖 Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: ${costFooter}`;
    }

    // Execute git commit
    try {
      execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, {
        stdio: 'pipe',
        cwd: baseDir
      });
    } catch (error) {
      return {
        status: 'error',
        data: {},
        message: 'Failed to create git commit'
      };
    }

    // Get commit SHA
    let commitSha;
    try {
      commitSha = execSync('git rev-parse HEAD', { cwd: baseDir, encoding: 'utf-8' }).trim();
    } catch {
      return {
        status: 'error',
        data: {},
        message: 'Failed to retrieve commit SHA'
      };
    }

    if (!commitSha) {
      return {
        status: 'error',
        data: {},
        message: 'Failed to retrieve commit SHA'
      };
    }

    return {
      status: 'success',
      data: { commit_sha: commitSha },
      message: 'Commit created successfully'
    };
  } catch (error) {
    return {
      status: 'error',
      data: {},
      message: error.message
    };
  }
}

/**
 * CLI entry point
 */
async function main() {
  const action = process.argv[2];
  const pluginRoot = detectPluginRoot(import.meta.url);

  let result;

  try {
    switch (action) {
      case 'check-config':
        result = checkConfig();
        break;

      case 'prepare':
        result = await prepare({ baseDir: '.', pluginRoot });
        break;

      case 'commit':
        result = await commit({ baseDir: '.', pluginRoot });
        break;

      default:
        result = {
          status: 'error',
          data: {},
          message: `Unknown action: ${action}`
        };
        break;
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    console.log(JSON.stringify({
      status: 'error',
      data: {},
      message: error.message
    }, null, 2));
    process.exit(1);
  }
}

// CLI entry guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.log(JSON.stringify({
      status: 'error',
      data: {},
      message: err.message
    }, null, 2));
    process.exit(1);
  });
}
