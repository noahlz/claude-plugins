import fs from 'fs';
import path from 'path';

/**
 * Parse JSON file with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {object|null} - Parsed JSON or null if file doesn't exist
 * @throws {Error} - If file exists but is invalid JSON
 */
export function parseJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

/**
 * Write JSON file with formatting
 * @param {string} filePath - Path to write to
 * @param {object} data - Data to write
 */
export function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Load skill config from .claude/settings.plugins.{skillName}.json
 * @param {string} skillName - Skill name
 * @param {string} baseDir - Base directory (defaults to current dir)
 * @returns {object|null} - Parsed config or null if not found
 */
export function loadSkillConfig(skillName, baseDir = '.') {
  const configPath = path.join(baseDir, `.claude/settings.plugins.${skillName}.json`);
  return parseJsonFile(configPath);
}

/**
 * Deep merge two objects (second overwrites first)
 * @param {object} defaultObj - Default config
 * @param {object} projectObj - Project config (overrides)
 * @returns {object} - Merged config
 */
function mergeConfigs(defaultObj, projectObj) {
  if (!defaultObj) return projectObj;
  if (!projectObj) return defaultObj;

  const result = JSON.parse(JSON.stringify(defaultObj));

  for (const key in projectObj) {
    if (projectObj[key] === null || projectObj[key] === undefined) {
      continue;
    }

    if (typeof projectObj[key] === 'object' && !Array.isArray(projectObj[key])) {
      result[key] = mergeConfigs(result[key] || {}, projectObj[key]);
    } else {
      result[key] = projectObj[key];
    }
  }

  return result;
}

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
export function validateConfig(config) {
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

