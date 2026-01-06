#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parseJsonFile } from '../../../lib/config-loader.js';
import { pwdToSessionId } from './ccusage-utils.js';

/**
 * Load session configuration from .claude/settings.plugins.write-git-commit.json
 * Falls back to auto-detecting from current directory if config doesn't exist
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory (defaults to current dir)
 * @returns {object} - { sessionId, configExists, autoDetected, errors, warnings }
 */
export function loadSessionConfig(options = {}) {
  const { baseDir = '.' } = options;
  const errors = [];
  const warnings = [];

  const configPath = path.join(baseDir, '.claude/settings.plugins.write-git-commit.json');

  try {
    const config = parseJsonFile(configPath);

    if (config) {
      // Config exists - extract sessionId
      const sessionId = config.sessionId;
      if (!sessionId) {
        errors.push('Config file exists but missing sessionId field');
        return { sessionId: null, configExists: true, autoDetected: false, errors, warnings };
      }

      return {
        sessionId,
        configExists: true,
        autoDetected: false,
        errors,
        warnings
      };
    } else {
      // No config - auto-detect from pwd
      const currentDir = path.resolve(baseDir);
      const sessionId = pwdToSessionId(currentDir);

      return {
        sessionId,
        configExists: false,
        autoDetected: true,
        errors,
        warnings
      };
    }
  } catch (error) {
    errors.push(`Failed to load config: ${error.message}`);
    return {
      sessionId: null,
      configExists: false,
      autoDetected: false,
      errors,
      warnings
    };
  }
}

/**
 * CLI entry point
 * Outputs JSON with session configuration
 */
async function main() {
  try {
    const result = loadSessionConfig({ baseDir: '.' });

    // Format output as JSON
    const output = {
      status: result.errors.length > 0 ? 'error' : 'success',
      data: {
        sessionId: result.sessionId,
        configExists: result.configExists,
        autoDetected: result.autoDetected
      },
      message: result.errors.length > 0 ? result.errors.join('; ') : ''
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      data: {},
      message: error.message
    }, null, 2));
    process.exit(1);
  }
}

// CLI entry guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(JSON.stringify({
      status: 'error',
      data: {},
      message: err.message
    }, null, 2));
    process.exit(1);
  });
}
