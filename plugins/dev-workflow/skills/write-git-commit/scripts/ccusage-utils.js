#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Ensure ccusage is installed in the plugin's node_modules
 * @param {string} pluginRoot - Path to plugin root directory
 * @returns {Promise<void>}
 */
export async function ensureCcusageInstalled(pluginRoot) {
  const ccusagePath = path.join(pluginRoot, 'node_modules', 'ccusage');

  if (!fs.existsSync(ccusagePath)) {
    console.error('Installing ccusage library (first-time setup)...');
    console.error('This may take a moment...');
    try {
      execSync('npm install', { cwd: pluginRoot, stdio: 'inherit' });
      console.error('✓ ccusage installed successfully');
    } catch (error) {
      throw new Error(`Failed to install ccusage: ${error.message}`);
    }
  }
}

/**
 * Dynamically load ccusage modules
 * Call ensureCcusageInstalled() first to guarantee availability
 * @returns {Promise<{dataLoader, calculateCost}>}
 */
export async function loadCcusage() {
  try {
    const dataLoader = await import('ccusage/data-loader');
    const calculateCost = await import('ccusage/calculate-cost');
    return { dataLoader, calculateCost };
  } catch (error) {
    throw new Error(`Failed to load ccusage modules: ${error.message}`);
  }
}

/**
 * Verify a session ID exists in ccusage data
 * @param {string} sessionId - Session ID to verify
 * @returns {Promise<{exists: boolean, error?: string}>}
 */
export async function verifySessionExists(sessionId) {
  try {
    const { dataLoader } = await loadCcusage();
    const session = await dataLoader.loadSessionUsageById(sessionId);
    return {
      exists: session !== null && session !== undefined,
      error: null
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * Fetch cost metrics for a specific session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} - Array of model cost breakdowns
 */
export async function fetchSessionCosts(sessionId) {
  try {
    const { dataLoader } = await loadCcusage();
    const session = await dataLoader.loadSessionUsageById(sessionId);

    if (!session) {
      return [];
    }

    // Extract and format model breakdowns
    if (!session.modelBreakdowns || !Array.isArray(session.modelBreakdowns)) {
      return [];
    }

    return session.modelBreakdowns.map(m => ({
      model: m.model,
      inputTokens: m.inputTokens || 0,
      outputTokens: m.outputTokens || 0,
      cost: Math.round((m.cost || 0) * 100) / 100
    }));
  } catch (error) {
    throw new Error(`Failed to fetch session costs for ${sessionId}: ${error.message}`);
  }
}

/**
 * Convert a directory path to session ID format
 * Example: /Users/foo/bar -> -Users-foo-bar
 * @param {string} dirPath - Directory path
 * @returns {string} - Session ID
 */
export function pwdToSessionId(dirPath) {
  // Remove leading slash and convert remaining slashes to dashes
  const normalized = dirPath.replace(/^\//, '').replace(/\//g, '-');
  // Prefix with dash to match original format
  return `-${normalized}`;
}
