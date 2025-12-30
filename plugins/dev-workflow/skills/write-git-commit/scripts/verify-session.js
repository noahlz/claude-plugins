#!/usr/bin/env node

import { detectPluginRoot } from '../../lib/common.js';
import { ensureCcusageInstalled, verifySessionExists } from './ccusage-utils.js';

/**
 * Verify a session ID exists in ccusage
 * @param {string} sessionId - Session ID to verify
 * @param {string} pluginRoot - Plugin root directory
 * @returns {Promise<object>} - { status, data, message }
 */
export async function verifySession(sessionId, pluginRoot) {
  if (!sessionId) {
    return {
      status: 'error',
      data: {},
      message: 'No session ID provided'
    };
  }

  try {
    // Ensure ccusage is installed
    await ensureCcusageInstalled(pluginRoot);

    // Verify session exists
    const { exists, error } = await verifySessionExists(sessionId);

    if (error) {
      return {
        status: 'error',
        data: {},
        message: `Failed to verify session: ${error}`
      };
    }

    if (exists) {
      return {
        status: 'verified',
        data: { session_id: sessionId },
        message: ''
      };
    } else {
      return {
        status: 'not_found',
        data: { attempted_id: sessionId },
        message: 'Session not found in ccusage data'
      };
    }
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
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.log(JSON.stringify({
      status: 'error',
      data: {},
      message: 'Usage: verify-session.js <session_id>'
    }, null, 2));
    process.exit(1);
  }

  try {
    const pluginRoot = detectPluginRoot(import.meta.url);
    const result = await verifySession(sessionId, pluginRoot);
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
