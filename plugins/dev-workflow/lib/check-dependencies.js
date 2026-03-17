#!/usr/bin/env node

// Ensures plugin npm dependencies are installed.
// Usage: node check-dependencies.js <plugin-root-dir>
// Always exits 0 — output content is read by the skill preprocessor, not the exit code.
// Silent if node_modules already exists; runs npm install if missing, prints success or warning.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const pluginRoot = process.argv[2];
if (!pluginRoot) {
  console.log('WARNING: No plugin root directory provided to check-dependencies.js');
  process.exit(0);
}

const nodeModules = path.join(pluginRoot, 'node_modules');

if (fs.existsSync(nodeModules)) {
  process.exit(0);
}

try {
  execSync(`npm install --prefix "${pluginRoot}" --silent`, { stdio: 'pipe' });
  console.log('Plugin dependencies installed.');
  process.exit(0);
} catch {
  console.log('WARNING: Failed to install plugin dependencies.');
  process.exit(0);
}
