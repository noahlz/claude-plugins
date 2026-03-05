#!/usr/bin/env node

import { parseJsonFile } from '../../../lib/config-loader.js';
import { findFiles, fileExists, getNormalizedDir } from '../../../lib/file-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Use CLAUDE_SKILL_DIR env var (set by Claude Code) or fall back to import.meta.url for non-skill contexts
// scripts/ -> run-and-fix-tests/ -> skills/ -> dev-workflow/ (pluginRoot)
const DEFAULT_PLUGIN_ROOT = process.env.CLAUDE_SKILL_DIR
  ? path.resolve(process.env.CLAUDE_SKILL_DIR, '../..')
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Load tool registry from plugin default config
 * @param {string} pluginRoot - Plugin root directory (specific plugin, e.g., /path/to/plugins/dev-workflow)
 * @returns {object|null} - Tools registry
 */
export function loadToolRegistry(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const registryPath = path.join(pluginRoot, 'skills/run-and-fix-tests/assets/defaults/tools.json');
  return parseJsonFile(registryPath);
}

/**
 * Load default config for a specific tool
 * @param {string} toolName - Tool name (e.g., "npm")
 * @param {string} pluginRoot - Plugin root directory
 * @returns {object|null} - Tool default config
 */
export function loadToolDefaultConfig(toolName, pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const defaultPath = path.join(pluginRoot, `skills/run-and-fix-tests/assets/defaults/${toolName}.json`);
  return parseJsonFile(defaultPath);
}

/**
 * Detect which tools are present in the project
 * @param {object} options - Options
 * @param {string} options.pluginRoot - Plugin root directory
 * @param {string} options.rootDir - Project root directory (defaults to cwd)
 * @returns {array} - Array of detected tool objects
 */
export function detectTools(options = {}) {
  const { pluginRoot = DEFAULT_PLUGIN_ROOT, rootDir = '.' } = options;

  // Load tool registry
  const toolRegistry = loadToolRegistry(pluginRoot);
  if (!toolRegistry) {
    throw new Error('Cannot load tool registry from plugin');
  }

  const detected = [];

  for (const toolName in toolRegistry) {
    const configFile = toolRegistry[toolName].configFile;
    if (!configFile) continue;

    // Check if config file exists
    let found = false;
    let foundPath = null;

    if (configFile.includes('*')) {
      // Glob pattern
      const matches = findFiles(configFile, rootDir);
      if (matches.length > 0) {
        found = true;
        foundPath = matches[0];
      }
    } else {
      // Check at root first
      if (fileExists(path.join(rootDir, configFile))) {
        found = true;
        foundPath = path.join(rootDir, configFile);
      } else {
        // Search in subdirectories
        const matches = findFiles(path.basename(configFile), rootDir);
        if (matches.length > 0) {
          found = true;
          foundPath = matches[0];
        }
      }
    }

    if (found) {
      // Load tool's default config
      const toolConfig = loadToolDefaultConfig(toolName, pluginRoot);

      detected.push({
        tool: toolName,
        location: getNormalizedDir(foundPath, rootDir),
        configFile: path.basename(foundPath),
        config: toolConfig
      });
    }
  }

  return detected;
}

/* node:coverage disable */
/**
 * Main entry point
 */
async function main() {
  const rootDir = process.argv[2] || '.';

  try {
    const detected = detectTools({ rootDir });

    if (detected.length === 0) {
      console.error('Error: No build tools detected in project');
      process.exit(1);
    }

    console.log(JSON.stringify(detected, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
/* node:coverage enable */
