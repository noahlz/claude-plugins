#!/usr/bin/env node

// Checks that Node.js >= 22 is installed.
// Always exits 0 — output content is read by the skill preprocessor, not the exit code.
// Prints "✓ Node.js vX.Y.Z" on success, or an ERROR message if the requirement is not met.

const version = process.version; // e.g. "v22.1.0"
const major = parseInt(version.slice(1), 10);

if (major >= 22) {
  console.log(`✓ Node.js ${version}`);
  process.exit(0);
} else {
  console.log(`ERROR: Node.js 22+ required (found: ${version}). Install: https://nodejs.org/`);
  process.exit(0);
}
