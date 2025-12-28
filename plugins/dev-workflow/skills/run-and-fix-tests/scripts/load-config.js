#!/usr/bin/env node

import { detectPluginRoot, formatBashExports, resolvePath, ensureClaudeDir } from '../../lib/common.js';
import { loadSkillConfig, validateConfig, normalizeOldSchema, isOldSchema, loadAndNormalizeConfig } from '../../lib/config-loader.js';
import path from 'path';

/**
 * Load and process configuration
 * @param {object} options - Options
 * @param {string} options.pluginRoot - Plugin root directory
 * @param {string} options.baseDir - Base directory (defaults to cwd)
 * @returns {object} - { config, env, errors, warnings }
 */
export function loadConfig(options = {}) {
  const { pluginRoot, baseDir = '.' } = options;
  const errors = [];
  const warnings = [];

  // Load project config
  const projectConfig = loadSkillConfig('run-and-fix-tests', baseDir);
  if (!projectConfig) {
    errors.push('No project configuration found at .claude/settings.plugins.run-and-fix-tests.json');
    return { config: null, env: {}, errors, warnings };
  }

  // Check for old schema and normalize
  if (isOldSchema(projectConfig)) {
    warnings.push('Using deprecated buildTools schema. Please update to new build/test schema.');
  }
  const config = normalizeOldSchema(projectConfig);

  // Validate config
  const validationErrors = validateConfig(config);
  if (validationErrors.length > 0) {
    return { config: null, env: {}, errors: validationErrors, warnings };
  }

  // Generate environment variables
  const env = generateEnv(config, baseDir);

  return { config, env, errors, warnings };
}

/**
 * Generate environment variables from config
 * @param {object} config - Config object
 * @param {string} baseDir - Base directory for path resolution
 * @returns {object} - Environment variables
 */
export function generateEnv(config, baseDir = '.') {
  const env = {};
  const logDir = config.logDir || 'dist';

  // Determine single vs multi-build mode
  const isSingleBuild = !Array.isArray(config.build);

  env.BUILD_MULTI = isSingleBuild ? 'false' : 'true';

  if (isSingleBuild) {
    // Single-build mode
    const build = config.build;
    env.BUILD_CMD = build.command;
    env.BUILD_LOG = resolvePath(build.logFile, { logDir });
    env.BUILD_ERROR_PATTERN = build.errorPattern;
    env.BUILD_WORKING_DIR = build.workingDir || '.';
  } else {
    // Multi-build mode
    env.BUILD_COUNT = config.build.length;
    config.build.forEach((build, idx) => {
      env[`BUILD_${idx}_CMD`] = build.command;
      env[`BUILD_${idx}_LOG`] = resolvePath(build.logFile, { logDir });
      env[`BUILD_${idx}_ERROR_PATTERN`] = build.errorPattern;
      env[`BUILD_${idx}_WORKING_DIR`] = build.workingDir || '.';
    });
  }

  // Test configuration (always single)
  env.TEST_CMD = config.test.all.command;
  env.TEST_LOG = resolvePath(config.test.all.logFile, { logDir });
  env.TEST_ERROR_PATTERN = config.test.all.errorPattern;

  env.TEST_SINGLE_CMD = config.test.single.command;
  env.TEST_SINGLE_LOG = resolvePath(config.test.single.logFile, { logDir });
  env.TEST_SINGLE_ERROR_PATTERN = config.test.single.errorPattern;

  env.LOG_DIR = logDir;

  return env;
}

/**
 * Format config as JSON
 * @param {object} config - Config object
 * @returns {string} - JSON string
 */
export function formatJson(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Main entry point
 */
async function main() {
  const pluginRoot = process.argv[2];
  const format = process.argv[3] || 'bash'; // 'bash' or 'json'

  if (!pluginRoot) {
    console.error('Error: CLAUDE_PLUGIN_ROOT required as first argument');
    console.error('Usage: node load-config.js <plugin-root-path> [bash|json]');
    process.exit(1);
  }

  const result = loadConfig({ pluginRoot, baseDir: '.' });

  if (result.errors.length > 0) {
    result.errors.forEach(err => console.error(`Error: ${err}`));
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.error(`Warning: ${warn}`));
    }
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    result.warnings.forEach(warn => console.error(`Warning: ${warn}`));
  }

  if (format === 'json') {
    console.log(formatJson(result.config));
  } else {
    console.log(formatBashExports(result.env));
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
