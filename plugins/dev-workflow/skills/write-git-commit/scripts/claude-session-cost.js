#!/usr/bin/env node

import { detectPluginRoot } from '../../lib/common.js';
import { ensureCcusageInstalled, fetchSessionCosts } from './ccusage-utils.js';

/**
 * Get current session costs
 * @param {string} sessionId - Session ID
 * @param {string} pluginRoot - Plugin root directory
 * @returns {Promise<Array>} - Array of cost breakdowns
 */
export async function getSessionCosts(sessionId, pluginRoot) {
  if (!sessionId) {
    throw new Error('SESSION_ID environment variable not set');
  }

  try {
    // Ensure ccusage is installed
    await ensureCcusageInstalled(pluginRoot);

    // Fetch costs for the session
    const costs = await fetchSessionCosts(sessionId);

    if (!costs || costs.length === 0) {
      throw new Error(`Session '${sessionId}' not found in ccusage data`);
    }

    return costs;
  } catch (error) {
    throw error;
  }
}

/**
 * CLI entry point
 * Outputs JSON cost array to stdout
 */
async function main() {
  const sessionId = process.env.SESSION_ID;

  if (!sessionId) {
    console.error('Error: SESSION_ID environment variable not set');
    process.exit(1);
  }

  try {
    const pluginRoot = detectPluginRoot(import.meta.url);
    const costs = await getSessionCosts(sessionId, pluginRoot);
    // Output raw JSON array (no wrapper)
    console.log(JSON.stringify(costs, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
