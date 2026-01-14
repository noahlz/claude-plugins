#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import * as git from './git-operations.js';
import * as ccusage from './ccusage-operations.js';


/**
 * Create default dependency objects for production use
 * @returns {object} Dependencies object with git and ccusage operations
 */
function createDefaultDeps() {
  return {
    git: {
      execGit: git.execGit,
      commit: git.commit,
      getHeadSha: git.getHeadSha
    },
    ccusage: {
      loadSessionData: ccusage.loadSessionData,
      getProjectsDir: ccusage.getProjectsDir,
      getSessionCosts: ccusage.getSessionCosts,
      listLocalSessions: ccusage.listLocalSessions,
      findRecommendedSession: ccusage.findRecommendedSession,
      pwdToSessionId: ccusage.pwdToSessionId,
      extractCostMetrics: ccusage.extractCostMetrics,
      validateCostMetrics: ccusage.validateCostMetrics
    }
  };
}

/**
 * Save session configuration
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory (defaults to current dir)
 * @param {string} options.sessionId - Session ID to save
 * @returns {object} - { status, data, message }
 */
function saveConfig({ baseDir = '.', sessionId } = {}) {
  if (!sessionId) {
    return {
      status: 'error',
      data: {},
      message: 'sessionId parameter required'
    };
  }

  try {
    const configPath = path.join(baseDir, '.claude/settings.plugins.write-git-commit.json');
    const configDir = path.dirname(configPath);

    // Create .claude directory if needed
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write config
    const config = { sessionId };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return {
      status: 'success',
      data: { session_id: sessionId },
      message: 'Configuration saved'
    };
  } catch (error) {
    return {
      status: 'error',
      data: {},
      message: `Failed to save config: ${error.message}`
    };
  }
}

/**
 * Prepare for commit: fetch costs for a given session ID
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {string} options.sessionId - Session ID to fetch costs for (required if no config)
 * @param {object} options.deps - Dependencies object (required)
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepare(options = {}) {
  const { baseDir = '.', sessionId: providedSessionId, deps } = options;

  // Validate deps parameter
  if (!deps) {
    throw new Error('deps parameter required');
  }

  const { ccusage: ccusageOps } = deps;

  try {
    let sessionId = providedSessionId;

    // If no sessionId provided or "NOT_CONFIGURED", try to find recommendation
    if (!sessionId || sessionId === 'NOT_CONFIGURED') {
      const recommendation = ccusageOps.findRecommendedSession(baseDir);

      if (recommendation.match) {
        sessionId = recommendation.sessionId;
      } else {
        return {
          status: 'not_found',
          data: {
            calculated_session_id: ccusageOps.pwdToSessionId(path.resolve(baseDir))
          },
          message: 'Session not found for current directory'
        };
      }
    }

    // Fetch costs for the session using ccusage library
    const costResult = await ccusageOps.getSessionCosts(sessionId);

    if (!costResult.success) {
      return {
        status: 'error',
        data: { session_id: sessionId },
        message: costResult.error
      };
    }

    // Validate costs before returning success
    if (!ccusageOps.validateCostMetrics(costResult.costs)) {
      return {
        status: 'invalid_costs',
        data: {
          session_id: sessionId,
          costs: costResult.costs
        },
        message: 'Cost metrics validation failed: metrics are empty, missing required fields, or all values are zero'
      };
    }

    return {
      status: 'success',
      data: {
        session_id: sessionId,
        current_cost: costResult.costs
      },
      message: 'Session costs resolved'
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
async function readCommitMessage(inputStream = null) {
  // Use provided stream or default to stdin
  const stream = inputStream || process.stdin;

  const chunks = [];
  for await (const chunk of stream) {
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
 * Note: SESSION_ID and CURRENT_COST are expected to be provided by skill orchestration
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {object} options.deps - Dependencies object (required)
 * @returns {Promise<object>} - { status, data, message }
 */
async function commit(options = {}) {
  const {
    baseDir = '.',
    sessionId: providedSessionId = null,
    costs: providedCosts = null,
    message: providedMessage = null,
    deps
  } = options;

  // Validate deps parameter
  if (!deps) {
    throw new Error('deps parameter required');
  }

  const { git: gitOps, ccusage: ccusageOps } = deps;

  try {
    // Create input stream from provided message or use stdin
    let inputStream = null;
    if (providedMessage !== null && providedMessage !== undefined) {
      inputStream = Readable.from([Buffer.from(providedMessage)]);
    }

    // Read commit message from stream or stdin
    const { subject, body } = await readCommitMessage(inputStream);

    if (!subject) {
      return {
        status: 'error',
        data: {},
        message: 'Missing commit subject (first line of stdin)'
      };
    }

    // Require CLI arguments (no fallbacks)
    let sessionId = providedSessionId;
    let currentCost = providedCosts;

    // Session ID is required
    if (!sessionId) {
      return {
        status: 'error',
        data: {},
        message: 'Session ID not provided (use --session-id argument)'
      };
    }

    // Current cost is required
    if (!currentCost) {
      return {
        status: 'error',
        data: {},
        message: 'Cost metrics not provided (use --costs argument)'
      };
    }

    // Parse if it's a string
    if (typeof currentCost === 'string') {
      try {
        currentCost = JSON.parse(currentCost);
      } catch (error) {
        return {
          status: 'error',
          data: {},
          message: `Invalid JSON in --costs argument: ${error.message}`
        };
      }
    }

    // Validate metrics before commit
    const costsArray = Array.isArray(currentCost) ? currentCost : [currentCost];

    if (!ccusageOps.validateCostMetrics(costsArray)) {
      return {
        status: 'metrics_invalid',
        data: { session_id: sessionId, attempted_costs: costsArray },
        message: 'Cost metrics validation failed'
      };
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

    // Execute git commit with better error handling
    const commitResult = gitOps.commit(fullMessage, { cwd: baseDir });
    if (commitResult.exitCode !== 0) {
      return {
        status: 'git_error',
        data: { error_message: commitResult.stderr },
        message: 'Failed to create git commit'
      };
    }

    // Verify commit succeeded
    const commitSha = gitOps.getHeadSha({ cwd: baseDir });
    if (!commitSha) {
      return {
        status: 'git_error',
        data: {},
        message: 'Failed to retrieve commit SHA'
      };
    }

    // Check if changes are still staged (indicates failure)
    const stagedResult = gitOps.execGit(['diff', '--cached', '--name-only'], { cwd: baseDir });
    if (stagedResult.stdout.trim()) {
      return {
        status: 'git_error',
        data: { staged_changes: stagedResult.stdout },
        message: 'Git commit execution failed - changes still staged'
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

  let result;
  let outputFile;

  // Parse CLI arguments
  const args = process.argv.slice(3);

  /* node:coverage disable */
  // Create real dependency objects for all actions that need them
  const deps = createDefaultDeps();

  try {
    switch (action) {
      case 'list-sessions': {
        outputFile = args[0];
        result = deps.ccusage.listLocalSessions();
        break;
      }

      case 'prepare': {
        const baseDir = args[0] || '.';
        const sessionId = args[1] || null;
        outputFile = args[2];
        result = await prepare({ baseDir, sessionId, deps });
        break;
      }

      case 'save-config': {
        const baseDir = args[0] || '.';
        const sessionId = args[1];
        outputFile = args[2];
        result = saveConfig({ baseDir, sessionId });
        break;
      }

      case 'commit': {
        // Parse --session-id and --costs from args
        const sessionIdIndex = args.indexOf('--session-id');
        const costsIndex = args.indexOf('--costs');

        const sessionId = sessionIdIndex !== -1 ? args[sessionIdIndex + 1] : null;
        const costs = costsIndex !== -1 ? args[costsIndex + 1] : null;

        result = await commit({
          baseDir: '.',
          sessionId,
          costs,
          deps
        });
        break;
      }

      default:
        outputFile = args[0];
        result = {
          status: 'error',
          data: {},
          message: `Unknown action: ${action}`
        };
        break;
    }

    // Output result as JSON
    const output = JSON.stringify(result, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    const errorResult = {
      status: 'error',
      data: {},
      message: error.message
    };

    const output = JSON.stringify(errorResult, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(1);
  }
}

// Export functions for testing
export { createDefaultDeps, saveConfig, prepare, commit, readCommitMessage };

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
/* node:coverage enable */
