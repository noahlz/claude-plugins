#!/usr/bin/env node

// Checks whether includeGitInstructions is disabled via env var or settings files.
// Always exits 0 — output content is read by the skill preprocessor, not the exit code.
// Prints "OK" if disabled, or a WARNING message otherwise.

import fs from 'fs';

if (process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS === '1') {
  console.log('OK');
  process.exit(0);
}

const settingsFiles = [
  `${process.env.HOME}/.claude/settings.json`,
  '.claude/settings.json',
];

const isDisabled = settingsFiles.some(p => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).includeGitInstructions === false;
  } catch {
    return false;
  }
});

if (isDisabled) {
  console.log('OK');
  process.exit(0);
} else {
  console.log(
    'WARNING: includeGitInstructions is not disabled. Built-in git instructions may conflict with this skill. ' +
    'Set includeGitInstructions: false in .claude/settings.json — see skill README for details.'
  );
  process.exit(0);
}
