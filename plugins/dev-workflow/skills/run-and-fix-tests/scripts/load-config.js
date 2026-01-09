#!/usr/bin/env node

import { resolvePath } from '../../../lib/common.js';
import { loadSkillConfig } from '../../../lib/config-loader.js';

/**
 * Validate build configuration (array format)
 * @param {array} buildConfig - Build configuration array
 * @param {array} errors - Errors array to append to
 */
function validateBuildConfig(buildConfig, errors) {
  if (!Array.isArray(buildConfig)) {
    errors.push('build must be an array');
    return;
  }

  if (buildConfig.length === 0) {
    errors.push('build array cannot be empty');
    return;
  }

  buildConfig.forEach((build, idx) => {
    if (!build.command) errors.push(`build[${idx}].command is required`);
    if (!build.logFile) errors.push(`build[${idx}].logFile is required`);
    if (!build.errorPattern) errors.push(`build[${idx}].errorPattern is required`);
  });
}

/**
 * Validate config has required fields
 * @param {object} config - Config object
 * @returns {array} - Array of error messages (empty if valid)
 */
function validateConfig(config) {
  const errors = [];

  if (!config) {
    errors.push('Config is null or undefined');
    return errors;
  }

  // Check for build config (optional if skipBuild is true)
  if (config.skipBuild === true) {
    // When skipBuild is explicitly true, build config is optional
    if (config.build) {
      validateBuildConfig(config.build, errors);
    }
  } else {
    // Build is required unless skipBuild is true
    if (!config.build) {
      errors.push('Config must have "build" property (or set skipBuild: true)');
      return errors;
    }

    validateBuildConfig(config.build, errors);
  }

  // Check for test config
  if (!config.test) {
    errors.push('Config must have "test" property');
    return errors;
  }

  if (!config.test.all) {
    errors.push('test.all is required');
  } else {
    if (!config.test.all.command) errors.push('test.all.command is required');
    if (!config.test.all.resultsPath) errors.push('test.all.resultsPath is required');
    if (!config.test.all.errorPattern) errors.push('test.all.errorPattern is required');
  }

  if (!config.test.single) {
    errors.push('test.single is required');
  } else {
    if (!config.test.single.command) errors.push('test.single.command is required');
    if (!config.test.single.resultsPath) errors.push('test.single.resultsPath is required');
    if (!config.test.single.errorPattern) errors.push('test.single.errorPattern is required');
  }

  return errors;
}

/**
 * Load and process configuration
 * @param {object} options - Options
 * @param {string} options.pluginRoot - Plugin root directory
 * @param {string} options.baseDir - Base directory (defaults to cwd)
 * @returns {object} - { config, env, errors, warnings }
 */
export function loadConfig(options = {}) {
  const { baseDir = '.' } = options;
  const errors = [];
  const warnings = [];

  // Load project config
  const projectConfig = loadSkillConfig('run-and-fix-tests', baseDir);
  if (!projectConfig) {
    errors.push('No project configuration found at .claude/settings.plugins.run-and-fix-tests.json');
    return { config: null, env: {}, errors, warnings };
  }

  const config = projectConfig;

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
  const outDir = config.outDir || 'dist';

  // Build configuration (always array format)
  if (config.build && Array.isArray(config.build)) {
    env.BUILD_COUNT = config.build.length.toString();
    config.build.forEach((build, idx) => {
      env[`BUILD_${idx}_CMD`] = build.command;
      env[`BUILD_${idx}_LOG`] = resolvePath(build.logFile, { outDir });
      env[`BUILD_${idx}_ERROR_PATTERN`] = build.errorPattern;
      env[`BUILD_${idx}_WORKING_DIR`] = build.workingDir || '.';
      env[`BUILD_${idx}_NATIVE_OUTPUT`] = build.nativeOutputSupport ? 'true' : 'false';
    });
  }

  // Test configuration (always single)
  env.TEST_CMD = config.test.all.command;
  env.TEST_RESULTS_PATH = resolvePath(config.test.all.resultsPath, { outDir });
  env.TEST_ERROR_PATTERN = config.test.all.errorPattern;
  env.TEST_NATIVE_OUTPUT = config.test.all.nativeOutputSupport ? 'true' : 'false';

  env.TEST_SINGLE_CMD = config.test.single.command;
  env.TEST_SINGLE_RESULTS_PATH = resolvePath(config.test.single.resultsPath, { outDir });
  env.TEST_SINGLE_ERROR_PATTERN = config.test.single.errorPattern;
  env.TEST_SINGLE_NATIVE_OUTPUT = config.test.single.nativeOutputSupport ? 'true' : 'false';

  // Optional single log file for all test runs (human inspection)
  if (config.logFile) {
    env.TEST_LOG = resolvePath(config.logFile, { outDir });
  }

  env.OUT_DIR = outDir;

  // Auto-detect if build should be skipped
  let skipBuild = false;

  // Check explicit flag first (allows override)
  if (config.skipBuild !== undefined) {
    skipBuild = config.skipBuild;
  } else if (config.build && config.build.length === 1 && env.BUILD_0_CMD === env.TEST_CMD) {
    // Auto-detect: single build command matches test command
    skipBuild = true;
  }

  env.SKIP_BUILD = skipBuild ? 'true' : 'false';

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
  const format = process.argv[2] || 'bash'; // 'bash' or 'json'

  const result = loadConfig({ baseDir: '.' });

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
    // Output simple key=value pairs for LLM to capture
    for (const [key, value] of Object.entries(result.env)) {
      console.log(`${key}=${value}`);
    }
  }
}




// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
