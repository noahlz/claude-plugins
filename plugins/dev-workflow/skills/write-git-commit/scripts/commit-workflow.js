#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import * as git from './git-operations.js';
import { parseJsonFile } from '../../../lib/config-loader.js';
import * as ccusage from './ccusage-operations.js';

/**
 * Escape string for safe use in shell single-quoted strings
 * Single quote becomes: '\''
 */
function shellEscape(str) {
  return String(str).replace(/'/g, "'\\''");
}

/**
 * Convert result object to sourceable shell variable assignments
 */
function exportAsShellVars(result) {
  const lines = [];

  // Always export status
  lines.push(`RESULT_STATUS='${shellEscape(result.status)}'`);

  // Export message if present
  if (result.message) {
    lines.push(`RESULT_MESSAGE='${shellEscape(result.message)}'`);
  }

  // Export data fields based on status
  if (result.status === 'success' && result.data) {
    if (result.data.session_id) {
      lines.push(`SESSION_ID='${shellEscape(result.data.session_id)}'`);
    }
    if (result.data.current_cost) {
      // Export array as JSON string (bash can't handle complex types)
      lines.push(`CURRENT_COST='${shellEscape(JSON.stringify(result.data.current_cost))}'`);
    }
    if (result.data.method) {
      lines.push(`METHOD='${shellEscape(result.data.method)}'`);
    }
  }

  if (result.status === 'found' && result.data) {
    if (result.data.config) {
      // check-config success case
      lines.push(`SESSION_ID='${shellEscape(result.data.config.sessionId)}'`);
    } else if (result.data.session_id) {
      // resolve-session success case
      lines.push(`SESSION_ID='${shellEscape(result.data.session_id)}'`);
    }
  }

  if (result.status === 'not_found' && result.data) {
    // resolve-session not_found case
    if (result.data.calculated_session_id) {
      lines.push(`CALCULATED_SESSION_ID='${shellEscape(result.data.calculated_session_id)}'`);
    }
  }

  if (result.status === 'need_selection' && result.data) {
    // Export sessions as JSON string
    if (result.data.sessions) {
      lines.push(`SESSIONS='${shellEscape(JSON.stringify(result.data.sessions))}'`);
    }
    if (result.data.recommended) {
      lines.push(`RECOMMENDED_SESSION='${shellEscape(result.data.recommended)}'`);
    }
  }

  return lines.join('\n');
}

/**
 * Resolve session costs
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} - { success, costs, error? }
 */
async function resolveSessionCosts(sessionId) {
  return await ccusage.getSessionCosts(sessionId);
}

/**
 * List available sessions
 * @returns {Promise<object>} - { status, data, error? }
 */
async function listSessions() {
  return await ccusage.listSessions();
}

/**
 * Resolve session ID from working directory with verification
 * Returns not_found if verification fails
 * @param {object} options - Options object
 * @param {string} options.baseDir - Base directory (defaults to current dir)
 * @returns {Promise<object>} - { status: 'found' | 'not_found', data, message }
 */
async function resolveSession(options = {}) {
  const { baseDir = '.' } = options;

  try {
    // Step 1: Calculate recommended session ID from baseDir
    const absolutePath = path.resolve(baseDir);
    const calculatedSessionId = ccusage.pwdToSessionId(absolutePath);

    // Step 2: Try to verify it exists
    const verify = await ccusage.verifySession(calculatedSessionId);

    if (verify.success && verify.exists) {
      // Session found!
      return {
        status: 'found',
        data: { session_id: calculatedSessionId },
        message: `Session resolved: ${calculatedSessionId}`
      };
    }

    // Step 3: Session not found - return not_found with calculated ID
    return {
      status: 'not_found',
      data: { calculated_session_id: calculatedSessionId },
      message: `Session not found: ${calculatedSessionId}`
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
 * Check if config file exists and is valid
 * @param {object} options - Options object
 * @param {string} options.baseDir - Base directory (defaults to current dir)
 * @returns {object} - { status, data, message }
 */
function checkConfig({ baseDir = '.' } = {}) {
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
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepare(options = {}) {
  const { baseDir = '.', sessionId: providedSessionId } = options;

  try {
    // Handle "NOT_CONFIGURED" special value from preprocessing
    let sessionId = providedSessionId;
    if (sessionId === 'NOT_CONFIGURED' || !sessionId) {
      const configResult = checkConfig({ baseDir });

      if (configResult.status === 'found') {
        sessionId = configResult.data.config.sessionId;
      } else {
        // No config - try to auto-detect from current directory
        const resolveResult = await resolveSession({ baseDir });

        if (resolveResult.status === 'found') {
          sessionId = resolveResult.data.session_id;
        } else {
          // Could not auto-detect session
          return {
            status: 'error',
            data: {},
            message: 'Session not found. No config exists and could not auto-detect session from current directory.'
          };
        }
      }
    }

    // Fetch costs for the session
    const costResult = await resolveSessionCosts(sessionId);

    if (!costResult.success) {
      return {
        status: 'error',
        data: { session_id: sessionId },
        message: costResult.error
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
 * @returns {Promise<object>} - { status, data, message }
 */
async function commit(options = {}) {
  const {
    baseDir = '.',
    sessionId: providedSessionId = null,
    costs: providedCosts = null,
    message: providedMessage = null
  } = options;

  try {
    // Create input stream from provided message or use stdin
    let inputStream = null;
    if (providedMessage) {
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
      } catch {
        currentCost = JSON.parse(currentCost);
      }
    }

    // Validate metrics before commit
    const costsArray = Array.isArray(currentCost) ? currentCost : [currentCost];

    if (!ccusage.validateCostMetrics(costsArray)) {
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
    const commitResult = git.commit(fullMessage, { cwd: baseDir });
    if (commitResult.exitCode !== 0) {
      return {
        status: 'git_error',
        data: { error_message: commitResult.stderr },
        message: 'Failed to create git commit'
      };
    }

    // Verify commit succeeded
    const commitSha = git.getHeadSha({ cwd: baseDir });
    if (!commitSha) {
      return {
        status: 'git_error',
        data: {},
        message: 'Failed to retrieve commit SHA'
      };
    }

    // Check if changes are still staged (indicates failure)
    const stagedResult = git.execGit(['diff', '--cached', '--name-only'], { cwd: baseDir });
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
  let exportVars = false;

  // Check for --export-vars flag in arguments
  const args = process.argv.slice(3);
  const exportVarsIndex = args.indexOf('--export-vars');
  if (exportVarsIndex !== -1) {
    exportVars = true;
    args.splice(exportVarsIndex, 1); // Remove flag from args
  }

  try {
    switch (action) {
      case 'check-config': {
        const baseDir = args[0] || '.';
        outputFile = args[1];
        result = checkConfig({ baseDir });
        break;
      }

      case 'resolve-session': {
        const baseDir = args[0] || '.';
        outputFile = args[1];
        result = await resolveSession({ baseDir });
        break;
      }

      case 'list-sessions': {
        outputFile = args[0];
        result = await listSessions();
        break;
      }

      case 'prepare': {
        const baseDir = args[0] || '.';
        const sessionId = args[1] || null;
        outputFile = args[2];
        result = await prepare({ baseDir, sessionId });
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
          costs
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

    // Output result
    let output;

    if (exportVars) {
      output = exportAsShellVars(result);
    } else {
      output = JSON.stringify(result, null, 2);
    }

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

    let output;
    if (exportVars) {
      output = exportAsShellVars(errorResult);
    } else {
      output = JSON.stringify(errorResult, null, 2);
    }

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(1);
  }
}

// Export functions for testing
export { checkConfig, resolveSession, listSessions, prepare, saveConfig, commit };

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
