#!/usr/bin/env node

import { resolvePath } from '../../../lib/common.js';
import { loadSkillConfig } from '../../../lib/config-loader.js';

/**
 * Validate build configuration
 * @param {Object} buildConfig - Build configuration 
 * @param {array} errors - Errors array to append to
 */
function validateBuildConfig(buildConfig, errors) {
  if (!buildConfig.command) errors.push(`build.command is required`);
  if (!buildConfig.logFile) errors.push(`build.logFile is required`);
  if (!buildConfig.errorPattern) errors.push(`build.errorPattern is required`);
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
 * Resolve config - expands placeholders and computes derived values
 * @param {object} config - Config object
 * @returns {object} - Resolved config with expanded paths and computed fields
 */
export function resolveConfig(config) {
  const resolved = JSON.parse(JSON.stringify(config)); // Deep copy
  const build = resolved.build;
  const test = resolved.test
  const outDir = resolved.outDir;

  if (build) {
    build.logFile = resolvePath(build.logFile, { outDir });
    build.workingDir = build.workingDir || '.';
  }

  // Resolve test paths
  if (test && test.all) {
    test.all.resultsPath = resolvePath(test.all.resultsPath, { outDir });
  }
  if (test && test.single) {
    test.single.resultsPath = resolvePath(test.single.resultsPath, { outDir });
  }

  // Resolve optional logFile
  if (resolved.logFile) {
    resolved.logFile = resolvePath(resolved.logFile, { outDir });
  }

  // Compute skipBuild
  let skipBuild = false;
  if (resolved.skipBuild !== undefined) {
    skipBuild = resolved.skipBuild;
  } else if (build && build.command === test.all.command) {
    skipBuild = true;
  }
  resolved.skipBuild = skipBuild;

  return resolved;
}

/**
 * Load and process configuration
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory (defaults to cwd)
 * @returns {object} - { resolved, errors, warnings }
 */
export function loadConfig(options = {}) {
  const { baseDir = '.' } = options;
  const errors = [];
  const warnings = [];

  // Load project config
  const projectConfig = loadSkillConfig('run-and-fix-tests', baseDir);
  if (!projectConfig) {
    errors.push('No project configuration found at .claude/settings.plugins.run-and-fix-tests.json');
    return { resolved: null, errors, warnings };
  }

  // Validate config
  const validationErrors = validateConfig(projectConfig);
  if (validationErrors.length > 0) {
    return { resolved: null, errors: validationErrors, warnings };
  }

  // Resolve configuration
  const resolved = resolveConfig(projectConfig);

  return { resolved, errors, warnings };
}

/**
 * Main entry point
 */
async function main() {
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

  // Output resolved config as JSON
  console.log(JSON.stringify(result.resolved, null, 2));
}




// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
