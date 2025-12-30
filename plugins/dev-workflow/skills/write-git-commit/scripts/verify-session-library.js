#!/usr/bin/env node

/**
 * Verify a session ID exists using ccusage library
 * Returns JSON: { status: 'success'|'error', exists: boolean, message: string }
 *
 * Usage: node verify-session-library.js <session_id>
 * Returns exit code 0 on success (regardless of exists status), 1 on error
 */

const sessionId = process.argv[2];

if (!sessionId) {
  console.log(JSON.stringify({
    status: 'error',
    exists: false,
    message: 'Usage: verify-session-library.js <session_id>'
  }));
  process.exit(1);
}

try {
  // Dynamic import to use correct ccusage API
  const { loadSessionData } = await import('ccusage/data-loader');

  // Load all sessions via library
  const sessions = await loadSessionData();

  // Find matching session
  const session = sessions.find(s => s.sessionId === sessionId);

  console.log(JSON.stringify({
    status: 'success',
    exists: session !== undefined,
    message: session ? 'Session found' : 'Session not found'
  }));

  process.exit(0);
} catch (error) {
  console.log(JSON.stringify({
    status: 'error',
    exists: false,
    message: `Failed to load sessions via library: ${error.message}`
  }));
  process.exit(1);
}
