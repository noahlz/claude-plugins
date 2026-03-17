#!/usr/bin/env node

// Checks whether a skill config file exists.
// Usage: node check-skill-config.js <config-file-path>
// Always exits 0 — output content is read by the skill preprocessor, not the exit code.
// Prints "✓ Configuration found" if the file exists, "NOT_CONFIGURED" otherwise.

import fs from 'fs';

const configPath = process.argv[2];
if (!configPath || !fs.existsSync(configPath)) {
  console.log('NOT_CONFIGURED');
} else {
  console.log('✓ Configuration found');
}
