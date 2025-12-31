#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { detectPluginRoot } from '../../lib/common.js';
import { parseJsonFile } from '../../lib/config-loader.js';
import { loadSessionConfig } from './load-config.js';
import { ensureCcusageInstalled } from './ccusage-utils.js';
import { extractCostMetrics } from './ccusage-cli-fallback.js';

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

  if (result.status === 'found' && result.data && result.data.config) {
    // check-config success case
    lines.push(`SESSION_ID='${shellEscape(result.data.config.sessionId)}'`);
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
 * Verify session exists via ccusage library
 * @param {string} sessionId - Session ID to verify
 * @returns {Promise<object>} - { success, exists, error? }
 */
async function verifySessionViaLibrary(sessionId) {
  try {
    const { loadSessionData } = await import('ccusage/data-loader');
    const sessions = await loadSessionData();
    const session = sessions.find(s => s.sessionId === sessionId);

    return {
      success: true,
      exists: session !== undefined
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
 * Get session costs via ccusage library
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} - { success, costs, error? }
 */
async function getSessionCostsViaLibrary(sessionId) {
  try {
    const { loadSessionData } = await import('ccusage/data-loader');
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
 * Verify session exists via ccusage CLI
 * @param {string} sessionId - Session ID to verify
 * @returns {object} - { success, exists, error? }
 */
function verifySessionViaCLI(sessionId) {
  try {
    const output = execSync('ccusage session --json', { encoding: 'utf-8' });
    let sessions = JSON.parse(output);

    // Handle both direct array and wrapped { sessions: [...] } format
    if (sessions.sessions && Array.isArray(sessions.sessions)) {
      sessions = sessions.sessions;
    }

    if (!Array.isArray(sessions)) {
      return {
        success: false,
        exists: false,
        error: 'Invalid format from ccusage CLI'
      };
    }

    const session = sessions.find(s => s.sessionId === sessionId);
    return {
      success: true,
      exists: session !== undefined
    };
  } catch (error) {
    const errorMsg = error.message || '';
    const isNotFound = error.code === 'ENOENT' ||
                       errorMsg.includes('not found') ||
                       errorMsg.includes('ENOENT') ||
                       errorMsg.includes('command not found');

    return {
      success: false,
      exists: false,
      error: isNotFound
        ? 'ccusage CLI not found - install with: npm install -g ccusage'
        : `Failed to verify session via CLI: ${errorMsg}`
    };
  }
}

/**
 * Get session costs via ccusage CLI
 * @param {string} sessionId - Session ID
 * @returns {object} - { success, costs, error? }
 */
function getSessionCostsViaCLI(sessionId) {
  try {
    const output = execSync('ccusage session --json', { encoding: 'utf-8' });
    let sessions = JSON.parse(output);

    // Handle both direct array and wrapped { sessions: [...] } format
    if (sessions.sessions && Array.isArray(sessions.sessions)) {
      sessions = sessions.sessions;
    }

    if (!Array.isArray(sessions)) {
      return {
        success: false,
        costs: [],
        error: 'Invalid format from ccusage CLI'
      };
    }

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
    const errorMsg = error.message || '';
    const isNotFound = error.code === 'ENOENT' ||
                       errorMsg.includes('not found') ||
                       errorMsg.includes('ENOENT') ||
                       errorMsg.includes('command not found');

    return {
      success: false,
      costs: [],
      error: isNotFound
        ? 'ccusage CLI not found - install with: npm install -g ccusage'
        : `Failed to fetch costs via CLI: ${errorMsg}`
    };
  }
}

/**
 * Resolve session costs using library-first, CLI-fallback strategy
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} - { success, costs, method, error? }
 */
async function resolveSessionCosts(sessionId) {
  // Try library first
  const libVerify = await verifySessionViaLibrary(sessionId);

  if (libVerify.success && libVerify.exists) {
    const libCosts = await getSessionCostsViaLibrary(sessionId);

    if (libCosts.success) {
      return {
        success: true,
        costs: libCosts.costs,
        method: 'library'
      };
    }
    // Library exists but fetch failed, fall through to CLI
  }

  // Fall back to CLI
  const cliVerify = verifySessionViaCLI(sessionId);

  if (cliVerify.success && cliVerify.exists) {
    const cliCosts = getSessionCostsViaCLI(sessionId);

    if (cliCosts.success) {
      return {
        success: true,
        costs: cliCosts.costs,
        method: 'cli'
      };
    }

    return {
      success: false,
      error: cliCosts.error
    };
  }

  // Session not found in either source
  return {
    success: false,
    error: `Session '${sessionId}' not found in library or CLI`
  };
}

/**
 * List available sessions from library or CLI
 * @returns {Promise<object>} - { status, data, method, error? }
 */
async function listSessions() {
  try {
    // Try library first
    const { loadSessionData } = await import('ccusage/data-loader');
    const sessions = await loadSessionData();

    return {
      status: 'success',
      data: sessions.map(s => ({
        sessionId: s.sessionId,
        cost: s.cost || 0
      })),
      method: 'library'
    };
  } catch (error) {
    // Fall back to CLI
    try {
      const output = execSync('ccusage session --json', { encoding: 'utf-8' });
      let sessions = JSON.parse(output);

      if (sessions.sessions && Array.isArray(sessions.sessions)) {
        sessions = sessions.sessions;
      }

      return {
        status: 'success',
        data: sessions.map(s => ({
          sessionId: s.sessionId,
          cost: s.cost || 0
        })),
        method: 'cli'
      };
    } catch (cliError) {
      return {
        status: 'error',
        data: [],
        error: 'Failed to list sessions via library or CLI'
      };
    }
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
 * Prepare for commit: check config, resolve costs from library or CLI
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {string} options.pluginRoot - Plugin root
 * @param {string} options.sessionId - Optional session ID to fetch costs for
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepare(options = {}) {
  const { baseDir = '.', pluginRoot, sessionId: providedSessionId } = options;

  try {
    // Determine sessionId (from parameter or config)
    let sessionId = providedSessionId;
    if (!sessionId) {
      // Try to load from config
      const configResult = checkConfig({ baseDir });

      if (configResult.status === 'found') {
        // Config exists - extract session ID
        sessionId = configResult.data.config.sessionId;
      } else if (configResult.status === 'not_found' || configResult.status === 'empty') {
        // No config - return need_selection with sessions list
        const sessionsResult = await listSessions();

        if (sessionsResult.status === 'error' || !sessionsResult.data || sessionsResult.data.length === 0) {
          return {
            status: 'no_sessions',
            data: {},
            message: 'No sessions found. Install ccusage: npm install -g ccusage'
          };
        }

        // Compute recommended session from current working directory
        const cwd = process.cwd();
        const recommendedSessionId = cwd.replace(/\//g, '-').replace(/^-/, '');

        return {
          status: 'need_selection',
          data: {
            sessions: sessionsResult.data,
            recommended: recommendedSessionId
          },
          message: 'Session selection required'
        };
      } else if (configResult.status === 'invalid') {
        // Config corrupted
        return {
          status: 'error',
          data: {},
          message: 'Configuration file is corrupted. Delete .claude/settings.plugins.write-git-commit.json'
        };
      }
    }

    // Have sessionId - proceed with existing cost fetch logic
    // Resolve costs using library-first, CLI-fallback
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
        current_cost: costResult.costs,
        method: costResult.method
      },
      message: `Session costs resolved via ${costResult.method}`
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
 * Note: SESSION_ID and CURRENT_COST are expected to be provided by skill orchestration
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

    // Load session config and environment
    let sessionId = process.env.SESSION_ID;
    let currentCost = process.env.CURRENT_COST;

    // If SESSION_ID not in env, try to load from config
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

    // CURRENT_COST must be provided by skill orchestration via env var
    if (!currentCost) {
      return {
        status: 'error',
        data: {},
        message: 'CURRENT_COST not provided by skill orchestration. This indicates a workflow issue.'
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
    const { validateCostMetrics } = await import('./ccusage-cli-fallback.js');
    const costsArray = Array.isArray(currentCost) ? currentCost : [currentCost];

    if (!validateCostMetrics(costsArray)) {
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
    let commitSha;
    try {
      // Use git commit -F - to pass message via stdin (better escaping)
      execSync('git commit -F -', {
        input: fullMessage,
        cwd: baseDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Verify commit succeeded
      commitSha = execSync('git rev-parse HEAD', { cwd: baseDir, encoding: 'utf-8' }).trim();

      // Check if changes are still staged (indicates failure)
      const statusOutput = execSync('git diff --cached --name-only', { cwd: baseDir, encoding: 'utf-8' });
      if (statusOutput.trim()) {
        return {
          status: 'git_error',
          data: { staged_changes: statusOutput },
          message: 'Git commit execution failed - changes still staged'
        };
      }
    } catch (error) {
      return {
        status: 'git_error',
        data: { error_message: error.message },
        message: 'Failed to create git commit'
      };
    }

    if (!commitSha) {
      return {
        status: 'git_error',
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
      case 'check-config':
        outputFile = args[0];
        result = checkConfig();
        break;

      case 'list-sessions': {
        outputFile = args[0];
        result = await listSessions();
        break;
      }

      case 'prepare': {
        const sessionId = args[0] || null;
        outputFile = args[1];
        result = await prepare({ baseDir: '.', pluginRoot, sessionId });
        break;
      }

      case 'save-config': {
        const sessionId = args[0];
        outputFile = args[1];
        result = saveConfig({ baseDir: '.', sessionId });
        break;
      }

      case 'commit':
        // commit doesn't need output file (uses stdin for message)
        result = await commit({ baseDir: '.', pluginRoot });
        break;

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
