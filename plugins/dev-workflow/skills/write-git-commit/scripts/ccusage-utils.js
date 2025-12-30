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
