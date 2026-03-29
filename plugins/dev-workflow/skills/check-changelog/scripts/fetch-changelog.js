#!/usr/bin/env node

import { execSync } from 'child_process';

export function createDefaultDeps() {
  return {
    exec: (cmd) => execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    })
  };
}

/**
 * Fetch changelog version-date mappings via gh api and raw content via curl.
 * @param {string} sinceDate - ISO 8601 date string to filter versions after
 * @param {object} deps - Dependencies { exec }
 * @param {object} [options] - Options
 * @param {number} [options.maxVersions=10] - Max versions to fetch
 * @returns {{ status: string, data?: object, error?: string }}
 */
export function fetchChangelog(sinceDate, deps, options = {}) {
  if (!deps) throw new Error('deps parameter required');

  const { maxVersions = 10 } = options;

  try {
    // Check gh CLI is available
    try {
      deps.exec('gh --version');
    } catch {
      return { status: 'error', error: 'gh CLI is required. Install from https://cli.github.com/' };
    }

    // Get commit SHAs and dates for CHANGELOG.md in one call
    const commitsRaw = deps.exec(
      `gh api "repos/anthropics/claude-code/commits?path=CHANGELOG.md&per_page=${maxVersions}" --jq '.[] | [.sha, .commit.author.date] | @tsv'`
    ).trim();

    if (!commitsRaw) {
      return { status: 'error', error: 'No commits found for CHANGELOG.md' };
    }

    const commits = commitsRaw.split('\n').map(line => {
      const [sha, date] = line.split('\t');
      return { sha, date };
    });

    // Filter to commits after sinceDate
    const matching = commits.filter(c => c.date >= sinceDate);

    // For each matching commit, extract the version from the patch
    const versions = [];
    for (const commit of matching) {
      try {
        const patch = deps.exec(
          `gh api "repos/anthropics/claude-code/commits/${commit.sha}" --jq '.files[0].patch'`
        );
        const match = patch.match(/^\+## (\d+\.\d+\.\d+)/m);
        if (match) {
          versions.push({
            version: match[1],
            date: commit.date,
            dateShort: commit.date.slice(0, 10)
          });
        }
      } catch {
        // Skip commits where patch extraction fails
      }
    }

    // Sort newest-first
    versions.sort((a, b) => b.date.localeCompare(a.date));

    // Fetch raw changelog content
    let changelogRaw;
    try {
      changelogRaw = deps.exec(
        'curl -sL https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md'
      );
    } catch (err) {
      return { status: 'error', error: `Failed to fetch changelog: ${err.message}` };
    }

    return {
      status: 'success',
      data: { versions, changelogRaw }
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/* node:coverage disable */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const sinceIndex = args.indexOf('--since');
  const maxIndex = args.indexOf('--max');

  const sinceDate = sinceIndex !== -1 ? args[sinceIndex + 1] : new Date(Date.now() - 30 * 86400000).toISOString();
  const maxVersions = maxIndex !== -1 ? parseInt(args[maxIndex + 1], 10) : 10;

  const result = fetchChangelog(sinceDate, createDefaultDeps(), { maxVersions });
  // Truncate changelogRaw in CLI output to avoid flooding stdout
  if (result.data?.changelogRaw) {
    result.data.changelogRaw = result.data.changelogRaw.slice(0, 500) + '\n... (truncated)';
  }
  console.log(JSON.stringify(result, null, 2));
}
/* node:coverage enable */
