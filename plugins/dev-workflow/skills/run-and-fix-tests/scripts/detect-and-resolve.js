#!/usr/bin/env node

import { detectPluginRoot } from '../../lib/common.js';
import { parseJsonFile, loadDefaultSkillConfig } from '../../lib/config-loader.js';
import { findFiles, fileExists, getNormalizedDir } from '../../lib/file-utils.js';
import path from 'path';

/**
 * Load tool registry from plugin default config
 * @param {string} pluginRoot - Plugin root directory
 * @returns {object|null} - Tools registry
 */
export function loadToolRegistry(pluginRoot) {
  const registry = loadDefaultSkillConfig('run-and-fix-tests', pluginRoot);
  return registry && registry.tools ? registry.tools : null;
}

/**
 * Load default config for a specific tool
 * @param {string} toolName - Tool name (e.g., "npm")
 * @param {string} pluginRoot - Plugin root directory
 * @returns {object|null} - Tool default config
 */
export function loadToolDefaultConfig(toolName, pluginRoot) {
  const defaultPath = path.join(pluginRoot, `skills/run-and-fix-tests/defaults/${toolName}.json`);
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
  const { pluginRoot, rootDir = '.' } = options;

  // Load tool registry
  const toolRegistry = loadToolRegistry(pluginRoot);
  if (!toolRegistry) {
    throw new Error('Cannot load tool registry from plugin');
  }

  const detected = [];

  for (const [toolName, toolInfo] of Object.entries(toolRegistry)) {
    const configFile = toolInfo.configFile;
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
        location: getNormalizedDir(foundPath),
        configFile: path.basename(foundPath),
        config: toolConfig
      });
    }
  }

  return detected;
}

/**
 * Main entry point
 */
async function main() {
  const pluginRoot = process.argv[2] || detectPluginRoot(import.meta.url);
  const rootDir = process.argv[3] || '.';

  try {
    const detected = detectTools({ pluginRoot, rootDir });

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

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
