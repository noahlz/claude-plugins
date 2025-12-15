#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Deep merge two objects
 * Values from source override values in target
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else if (source[key] !== undefined && source[key] !== null) {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Replace placeholders in object values
 * Currently supports {logDir}
 */
function replacePlaceholders(obj, logDir) {
  const result = {};
  for (const key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      result[key] = replacePlaceholders(obj[key], logDir);
    } else if (typeof obj[key] === 'string') {
      result[key] = obj[key].replace(/{logDir}/g, logDir);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Load and merge configuration files
 */
function loadConfig() {
  try {
    // 1. Load default config from plugin directory
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    if (!pluginRoot) {
      console.error('CLAUDE_PLUGIN_ROOT not set', process.stderr);
      process.exit(0);
    }

    const defaultConfigPath = path.join(pluginRoot, 'build-config.json');
    if (!fs.existsSync(defaultConfigPath)) {
      console.error(`Default config not found: ${defaultConfigPath}`, process.stderr);
      process.exit(0);
    }

    let config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));

    // 2. Check if project config exists
    const projectConfigPath = path.resolve('.claude', 'build-config.json');
    if (fs.existsSync(projectConfigPath)) {
      try {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
        config = deepMerge(config, projectConfig);
      } catch (err) {
        console.error(`Warning: Failed to parse project config: ${err.message}`, process.stderr);
      }
    }

    // 3. Replace placeholders
    const logDir = config.logDir || 'dist';
    config = replacePlaceholders(config, logDir);

    // 4. Output merged config as JSON
    console.log(JSON.stringify(config));
    process.exit(0);
  } catch (err) {
    console.error(`Config loading error: ${err.message}`, process.stderr);
    process.exit(0);
  }
}

loadConfig();
