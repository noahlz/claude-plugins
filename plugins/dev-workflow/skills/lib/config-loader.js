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
 * Load default skill config from plugin
 * @param {string} skillName - Skill name
 * @param {string} pluginRoot - Plugin root directory
 * @returns {object|null} - Parsed default config
 */
export function loadDefaultSkillConfig(pluginName, skillName, pluginRoot) {
  const defaultPath = path.join(pluginRoot, `${pluginName}/skills/${skillName}/defaults/settings.plugins.${skillName}.json`);
  return parseJsonFile(defaultPath);
}

/**
 * Deep merge two objects (second overwrites first)
 * @param {object} defaultObj - Default config
 * @param {object} projectObj - Project config (overrides)
 * @returns {object} - Merged config
 */
export function mergeConfigs(defaultObj, projectObj) {
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
 * Check if config uses old schema (buildTools array)
 * @param {object} config - Config object
 * @returns {boolean}
 */
export function isOldSchema(config) {
  return config && Array.isArray(config.buildTools);
}

/**
 * Normalize old schema to new schema
 * Old schema: { buildTools: [{ buildCmd, buildLog, buildErrorPattern, ... }] }
 * New schema: { build: { command, logFile, errorPattern, ... } }
 * @param {object} config - Config object with old schema
 * @returns {object} - Normalized config with new schema
 */
export function normalizeOldSchema(config) {
  if (!isOldSchema(config)) {
    return config;
  }

  const tool = config.buildTools[0];
  const normalized = {
    logDir: tool.logDir || 'dist',
    build: {
      command: tool.buildCmd,
      logFile: tool.buildLog,
      errorPattern: tool.buildErrorPattern
    },
    test: {
      all: {
        command: tool.testCmd,
        logFile: tool.testLog,
        errorPattern: tool.testErrorPattern
      },
      single: {
        command: tool.testSingleCmd,
        logFile: tool.testSingleLog,
        errorPattern: tool.testSingleErrorPattern
      }
    }
  };

  // Preserve any other top-level properties
  for (const key in config) {
    if (key !== 'buildTools' && !normalized.hasOwnProperty(key)) {
      normalized[key] = config[key];
    }
  }

  return normalized;
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

  // Check for build config
  if (!config.build) {
    errors.push('Config must have "build" property');
    return errors;
  }

  // For single-build (build is object)
  if (!Array.isArray(config.build)) {
    if (!config.build.command) errors.push('build.command is required');
    if (!config.build.logFile) errors.push('build.logFile is required');
    if (!config.build.errorPattern) errors.push('build.errorPattern is required');
  } else {
    // For multi-build (build is array)
    if (config.build.length === 0) {
      errors.push('build array cannot be empty');
    }

    config.build.forEach((build, idx) => {
      if (!build.command) errors.push(`build[${idx}].command is required`);
      if (!build.logFile) errors.push(`build[${idx}].logFile is required`);
      if (!build.errorPattern) errors.push(`build[${idx}].errorPattern is required`);
    });
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
    if (!config.test.all.logFile) errors.push('test.all.logFile is required');
    if (!config.test.all.errorPattern) errors.push('test.all.errorPattern is required');
  }

  if (!config.test.single) {
    errors.push('test.single is required');
  } else {
    if (!config.test.single.command) errors.push('test.single.command is required');
    if (!config.test.single.logFile) errors.push('test.single.logFile is required');
    if (!config.test.single.errorPattern) errors.push('test.single.errorPattern is required');
  }

  return errors;
}

/**
 * Load and normalize config from various sources
 * @param {object} options - Options
 * @param {string} options.skillName - Skill name
 * @param {string} options.pluginRoot - Plugin root directory
 * @param {string} options.baseDir - Base directory for .claude config
 * @returns {object} - { config, warnings }
 */
export function loadAndNormalizeConfig(options) {
  const { skillName, pluginRoot, baseDir = '.' } = options;
  const warnings = [];

  // Load default and project configs
  const defaultConfig = loadDefaultSkillConfig('dev-workflow', skillName, pluginRoot);
  const projectConfig = loadSkillConfig(skillName, baseDir);

  // Merge if both exist
  const merged = mergeConfigs(defaultConfig, projectConfig || {});

  // Normalize old schema
  if (isOldSchema(merged)) {
    warnings.push('Using deprecated buildTools schema. Please update to new build/test schema.');
  }
  const normalized = normalizeOldSchema(merged);

  return { config: normalized, warnings };
}
