#!/usr/bin/env node

import { execGit } from '../../../lib/git-operations.js';

function createDefaultDeps() {
  return {
    git: { execGit }
  };
}

/**
 * Get the date, SHA, and subject of the most recent git commit.
 * @param {object} deps - Dependencies object with git.execGit
 * @param {object} [options] - Options
 * @param {string} [options.cwd] - Working directory for git command
 * @returns {{ status: string, data?: object, error?: string }}
 */
export function getLastCommitDate(deps, options = {}) {
  if (!deps) throw new Error('deps parameter required');

  const result = deps.git.execGit(['log', '-1', '--format=%aI%n%h%n%s'], options);

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    const error = result.stderr.trim() || 'No commits found or git command failed';
    return { status: 'error', error };
  }

  const [isoDate, shortSha, subject] = result.stdout.trim().split('\n');

  if (!isoDate || !shortSha) {
    return { status: 'error', error: 'Unexpected git output format' };
  }

  return {
    status: 'success',
    data: {
      date: isoDate,
      dateShort: isoDate.slice(0, 10),
      sha: shortSha,
      message: subject || ''
    }
  };
}

/* node:coverage disable */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cwdIndex = args.indexOf('--cwd');
  const cwd = cwdIndex !== -1 ? args[cwdIndex + 1] : process.cwd();

  const result = getLastCommitDate(createDefaultDeps(), { cwd });
  console.log(JSON.stringify(result));
}
/* node:coverage enable */
