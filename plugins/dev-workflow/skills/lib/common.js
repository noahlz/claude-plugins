import { execSync } from 'child_process';

/**
 * Get CLAUDE_PLUGIN_ROOT from environment variable
 * @returns {string} - Path to plugin root
 * @throws {Error} If CLAUDE_PLUGIN_ROOT is not set
 */
export function detectPluginRoot() {
  if (!process.env.CLAUDE_PLUGIN_ROOT) {
    throw new Error('CLAUDE_PLUGIN_ROOT environment variable not set. Skill prerequisites must execute first.');
  }
  return process.env.CLAUDE_PLUGIN_ROOT;
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

