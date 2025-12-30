#!/usr/bin/env node

/**
 * Get session cost metrics using ccusage library
 * Returns JSON: { status: 'success'|'error', data: costs_array, message: string }
 *
 * Usage: node get-session-costs-library.js <session_id>
 * Returns exit code 0 on success, 1 on error
 */

const sessionId = process.argv[2];

if (!sessionId) {
  console.log(JSON.stringify({
    status: 'error',
    data: [],
    message: 'Usage: get-session-costs-library.js <session_id>'
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

  if (!session) {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: `Session '${sessionId}' not found`
    }));
    process.exit(1);
  }

  // Extract and format model breakdowns
  if (!session.modelBreakdowns || !Array.isArray(session.modelBreakdowns)) {
    console.log(JSON.stringify({
      status: 'error',
      data: [],
      message: `No model breakdowns found for session '${sessionId}'`
    }));
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
  }));

  process.exit(0);
} catch (error) {
  console.log(JSON.stringify({
    status: 'error',
    data: [],
    message: `Failed to retrieve costs via library: ${error.message}`
  }));
  process.exit(1);
}
