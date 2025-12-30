#!/usr/bin/env node

import { execSync } from 'child_process';

/**
 * Get session cost metrics using ccusage CLI
 * Returns JSON: { status: 'success'|'error', data: costs_array, message: string }
 *
 * Usage: node get-session-costs-cli.js <session_id>
 * Returns exit code 0 on success, 1 on error
 */

const sessionId = process.argv[2];

if (!sessionId) {
  console.log(JSON.stringify({
    status: 'error',
    data: [],
    message: 'Usage: get-session-costs-cli.js <session_id>'
  }, null, 2));
  process.exit(1);
}

try {
  // Load all sessions via CLI
  const output = execSync('ccusage session --json', { encoding: 'utf-8' });
  let sessions = JSON.parse(output);

  // Handle both direct array and wrapped { sessions: [...] } format
  if (sessions.sessions && Array.isArray(sessions.sessions)) {
    sessions = sessions.sessions;
  }

  if (!Array.isArray(sessions)) {
    throw new Error('Expected array of sessions from ccusage CLI');
  }

  // Find matching session
  const session = sessions.find(s => s.sessionId === sessionId);

  if (!session) {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: `Session '${sessionId}' not found`
    }, null, 2));
    process.exit(1);
  }

  // Extract and format model breakdowns
  if (!session.modelBreakdowns || !Array.isArray(session.modelBreakdowns)) {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: `No model breakdowns found for session '${sessionId}'`
    }, null, 2));
    process.exit(1);
  }

  const costs = session.modelBreakdowns.map(m => ({
    model: m.model || m.modelName || 'unknown',
    inputTokens: m.inputTokens || 0,
    outputTokens: m.outputTokens || 0,
    cost: Math.round((m.cost || 0) * 100) / 100
  }));

  console.log(JSON.stringify({
    status: 'success',
    data: costs,
    message: 'Cost metrics retrieved'
  }, null, 2));

  process.exit(0);
} catch (error) {
  // Check for various "command not found" error patterns
  const errorMsg = error.message || '';
  if (error.code === 'ENOENT' ||
      errorMsg.includes('not found') ||
      errorMsg.includes('ENOENT') ||
      errorMsg.includes('command not found')) {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: 'ccusage CLI not found - install with: npm install -g ccusage'
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: `Failed to retrieve costs via CLI: ${error.message}`
    }, null, 2));
  }
  process.exit(1);
}
