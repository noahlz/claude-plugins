#!/usr/bin/env node

import { detectPluginRoot } from '../../lib/common.js';
import { writeJsonFile, parseJsonFile } from '../../lib/config-loader.js';
import { copyFile, fileExists, ensureClaudeDir } from '../../lib/file-utils.js';
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
    // Multiple tools - generate polyglot config
    const polyglotConfig = generatePolyglotConfig(detectedTools, pluginRoot);
    writeJsonFile(configPath, polyglotConfig);

    return {
      configPath,
      source: 'polyglot',
      tools: detectedTools.map(t => t.tool),
      warnings: [
        `Multiple build tools detected, created polyglot configuration with ${detectedTools.length} tools`,
        `Review and customize ${configPath} as needed`
      ]
    };
  }
}

/**
 * Generate polyglot configuration for multiple tools
 * @param {array} detectedTools - Array of detected tool objects
 * @param {string} pluginRoot - Plugin root directory
 * @returns {object} - Polyglot config
 */
export function generatePolyglotConfig(detectedTools, pluginRoot) {
  // Load polyglot template
  const templatePath = path.join(pluginRoot, 'skills/run-and-fix-tests/assets/defaults/polyglot.json');
  const template = parseJsonFile(templatePath);

  if (!template) {
    throw new Error(`Polyglot template not found at ${templatePath}`);
  }

  // Build array from detected tools
  const buildArray = detectedTools
    .filter(tool => tool.config && tool.config.build && Array.isArray(tool.config.build) && tool.config.build.length > 0)
    .map(tool => {
      const build = tool.config.build[0]; // Get first build step
      return {
        tool: tool.tool,
        workingDir: build.workingDir || (tool.location === '(project root)' ? '.' : tool.location),
        command: build.command,
        logFile: `{logDir}/${tool.tool}-build.log`,
        errorPattern: build.errorPattern
      };
    });

  // Use first tool's test config (could be made configurable)
  let testConfig = template.test || {
    all: {
      command: 'npm test',
      logFile: '{logDir}/test.log',
      errorPattern: '(FAIL|●|Error:|Expected|Received)'
    },
    single: {
      command: 'npm test -- {testFile}',
      logFile: '{logDir}/test-single.log',
      errorPattern: '(FAIL|●|Error:|Expected|Received)'
    }
  };

  if (detectedTools[0]?.config?.test) {
    testConfig = detectedTools[0].config.test;
  }

  return {
    logDir: template.logDir || 'build-logs',
    build: buildArray,
    test: testConfig
  };
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

/**
 * Main entry point
 */
async function main() {
  const pluginRoot = process.argv[2] || detectPluginRoot();
  const detectedJson = process.argv[3];
  const targetDir = process.argv[4] || '.';

  if (!detectedJson) {
    console.error('Error: detected tools JSON required as second argument');
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
