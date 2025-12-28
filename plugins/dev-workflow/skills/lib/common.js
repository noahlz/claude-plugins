import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Detect CLAUDE_PLUGIN_ROOT from script location
 * Falls back to traversing up from script path if env var not set
 * @param {string} scriptPath - The import.meta.url of the calling script
 * @returns {string} - Path to plugin root
 */
export function detectPluginRoot(scriptPath) {
  // First check environment variable
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }

  // Parse file:// URL to get file path
  const filePath = scriptPath.replace('file://', '');

  // Traverse up from skills/run-and-fix-tests/scripts/ -> plugins/dev-workflow/
  // That's 3 levels up: scripts -> run-and-fix-tests -> skills -> dev-workflow (the root)
  const pluginRoot = path.resolve(filePath, '../../../..');

  if (fs.existsSync(pluginRoot)) {
    return pluginRoot;
  }

  // Fallback: try 4 levels up for lib/common.js
  const altRoot = path.resolve(filePath, '../../../../..');
  if (fs.existsSync(altRoot)) {
    return altRoot;
  }

  throw new Error(`Could not determine CLAUDE_PLUGIN_ROOT from ${scriptPath}`);
}

/**
 * Check if a command exists in PATH
 * @param {string} cmd - Command name
 * @returns {boolean} - True if command exists
 */
export function checkCommand(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve path variables like {logDir}
 * @param {string} pathStr - Path string with variables
 * @param {object} context - Context object with variables
 * @returns {string} - Resolved path
 */
export function resolvePath(pathStr, context = {}) {
  if (!pathStr) return pathStr;

  // Default variables
  const vars = {
    logDir: context.logDir || 'dist',
    ...context
  };

  // Replace {varName} with value
  return pathStr.replace(/{(\w+)}/g, (match, name) => {
    return vars[name] !== undefined ? vars[name] : match;
  });
}

/**
 * Format an object as bash export statements
 * @param {object} env - Object to export
 * @returns {string} - Bash export statements
 */
export function formatBashExports(env) {
  const lines = [];
  for (const [key, value] of Object.entries(env)) {
    if (value === null || value === undefined) continue;
    // Use printf %q for proper shell escaping
    // Simulate shell escaping for values that need it
    const escaped = String(value).replace(/'/g, "'\\''");
    lines.push(`export ${key}='${escaped}'`);
  }
  return lines.join('\n');
}

