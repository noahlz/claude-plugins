#!/usr/bin/env node

import { execSync } from 'child_process';

/**
 * Verify a session ID exists using ccusage CLI
 * Returns JSON: { status: 'success'|'error', exists: boolean, message: string }
 *
 * Usage: node verify-session-cli.js <session_id>
 * Returns exit code 0 on success (regardless of exists status), 1 on error
 */

const sessionId = process.argv[2];

if (!sessionId) {
  console.log(JSON.stringify({
    status: 'error',
    exists: false,
    message: 'Usage: verify-session-cli.js <session_id>'
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

  console.log(JSON.stringify({
    status: 'success',
    exists: session !== undefined,
    message: session ? 'Session found' : 'Session not found'
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
      exists: false,
      message: 'ccusage CLI not found - install with: npm install -g ccusage'
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      status: 'error',
      exists: false,
      message: `Failed to load sessions via CLI: ${error.message}`
    }, null, 2));
  }
  process.exit(1);
}
