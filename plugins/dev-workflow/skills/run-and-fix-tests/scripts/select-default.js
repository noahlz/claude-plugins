#!/usr/bin/env node

import { copyFile, fileExists, ensureClaudeDir } from '../../../lib/file-utils.js';
import path from 'path';

/**
 * Select and apply default configuration based on detected tools
 * @param {object} options - Options
 * @param {array} options.detectedTools - Array of detected tool objects
 * @param {string} options.pluginRoot - Plugin root directory
 * @param {string} options.targetDir - Target directory for config (defaults to cwd)
 * @returns {object} - { configPath, source, tools, warnings }
 */
export function selectDefault(options = {}) {
  const { detectedTools, pluginRoot, targetDir = '.' } = options;
  const warnings = [];

  // Create .claude directory
  ensureClaudeDir(targetDir);

  const configPath = path.join(targetDir, '.claude/settings.plugins.run-and-fix-tests.json');

  if (detectedTools.length === 0) {
    // No tools detected - use template
    const templatePath = path.join(pluginRoot, 'skills/run-and-fix-tests/assets/defaults/TEMPLATE.json');
    if (!fileExists(templatePath)) {
      throw new Error(`Template not found at ${templatePath}`);
    }

    copyFile(templatePath, configPath);

    warnings.push('PLACEHOLDER CONFIG CREATED - YOU MUST CUSTOMIZE IT');
    warnings.push(`Edit: ${configPath}`);
    warnings.push('Replace all __PLACEHOLDER_*__ values with your build/test commands');

    return {
      configPath,
      source: 'TEMPLATE.json',
      tools: [],
      warnings
    };
  } else if (detectedTools.length === 1) {
    // Single tool - copy its default
    const tool = detectedTools[0];
    const defaultPath = path.join(pluginRoot, `skills/run-and-fix-tests/assets/defaults/${tool.tool}.json`);

    if (fileExists(defaultPath)) {
      copyFile(defaultPath, configPath);
      return {
        configPath,
        source: `${tool.tool}.json`,
        tools: [tool.tool],
        warnings
      };
    } else {
      // No specific default for this tool - use template
      const templatePath = path.join(pluginRoot, 'skills/run-and-fix-tests/assets/defaults/TEMPLATE.json');
      if (!fileExists(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
      }

      copyFile(templatePath, configPath);

      warnings.push(`No default found for ${tool.tool}`);
      warnings.push('PLACEHOLDER CONFIG CREATED - YOU MUST CUSTOMIZE IT');
      warnings.push(`Edit: ${configPath}`);

      return {
        configPath,
        source: 'TEMPLATE.json',
        tools: [tool.tool],
        warnings
      };
    }
  } else {
    throw new Error("Polyglot projects not yet supported.")
  }
}

/**
 * Parse detected tools from JSON string or array
 * @param {string|array} detectedJson - JSON string or array
 * @returns {array} - Parsed detected tools
 */
function parseDetectedTools(detectedJson) {
  if (typeof detectedJson === 'string') {
    return JSON.parse(detectedJson);
  }
  return detectedJson;
}

/* node:coverage disable */
/**
 * Main entry point
 */
async function main() {
  const pluginRoot = process.argv[2];
  const detectedJson = process.argv[3];
  const targetDir = process.argv[4] || '.';

  if (!pluginRoot || !detectedJson) {
    console.error('Error: plugin root and detected tools JSON required');
    console.error('Usage: node select-default.js <plugin-root> <detected-json> [target-dir]');
    process.exit(1);
  }

  try {
    const detected = parseDetectedTools(detectedJson);
    const result = selectDefault({ detectedTools: detected, pluginRoot, targetDir });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
/* node:coverage enable */
