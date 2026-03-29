#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const API_BASE = 'https://api.github.com/repos/anthropics/claude-code';
const RAW_BASE = 'https://raw.githubusercontent.com/anthropics/claude-code/main';

export function createDefaultDeps() {
  return {
    exec: (cmd) => execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    }),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    tmpdir: () => tmpdir()
  };
}

/**
 * Compare two semver version strings.
 * @returns {number} positive if a > b, negative if a < b, 0 if equal
 */
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * Fetch changelog version-date mappings via GitHub REST API (curl) and raw content.
 * @param {string} sinceDate - ISO 8601 date string to filter versions after
 * @param {object} deps - Dependencies { exec, writeFile, tmpdir }
 * @param {object} [options] - Options
 * @param {number} [options.maxVersions=10] - Max versions to fetch
 * @param {string} [options.sinceVersion] - Version to filter from (e.g. "2.1.50"), overrides sinceDate
 * @returns {{ status: string, data?: object, error?: string }}
 */
export function fetchChangelog(sinceDate, deps, options = {}) {
  if (!deps) throw new Error('deps parameter required');

  const { maxVersions = 10, sinceVersion } = options;

  try {
    // Fetch raw changelog and write to temp file
    let changelogRaw, changelogFile;
    try {
      changelogRaw = deps.exec(
        `curl -sfL ${RAW_BASE}/CHANGELOG.md`
      );
      changelogFile = join(deps.tmpdir(), `claude-changelog-${Date.now()}.md`);
      deps.writeFile(changelogFile, changelogRaw);
    } catch (err) {
      return { status: 'error', error: `Failed to fetch changelog: ${err.message}` };
    }

    let versions;

    if (sinceVersion) {
      // Extract versions from changelog headers: ## X.Y.Z or ## X.Y.Z - YYYY-MM-DD
      const versionPattern = /^## (\d+\.\d+\.\d+)(?:\s.*)?$/gm;
      versions = [];
      let match;
      while ((match = versionPattern.exec(changelogRaw)) !== null) {
        const ver = match[1];
        if (compareSemver(ver, sinceVersion) > 0) {
          versions.push({ version: ver, date: null, dateShort: null });
        }
      }
      // Sort newest-first
      versions.sort((a, b) => compareSemver(b.version, a.version));
    } else {
      // Date-based: discover versions via GitHub commit API
      let commitsJson;
      try {
        const raw = deps.exec(
          `curl -sf "${API_BASE}/commits?path=CHANGELOG.md&per_page=${maxVersions}"`
        );
        commitsJson = JSON.parse(raw);
      } catch (err) {
        return { status: 'error', error: `Failed to fetch commits: ${err.message}` };
      }

      if (!Array.isArray(commitsJson) || commitsJson.length === 0) {
        return { status: 'error', error: 'No commits found for CHANGELOG.md' };
      }

      const commits = commitsJson.map(c => ({
        sha: c.sha,
        date: c.commit.author.date
      }));

      const matching = commits.filter(c => c.date >= sinceDate);

      versions = [];
      for (const commit of matching) {
        try {
          const raw = deps.exec(
            `curl -sf "${API_BASE}/commits/${commit.sha}"`
          );
          const detail = JSON.parse(raw);
          const patch = detail.files?.[0]?.patch || '';
          const m = patch.match(/^\+## (\d+\.\d+\.\d+)/m);
          if (m) {
            versions.push({
              version: m[1],
              date: commit.date,
              dateShort: commit.date.slice(0, 10)
            });
          }
        } catch {
          // Skip commits where fetch/parse fails
        }
      }

      versions.sort((a, b) => b.date.localeCompare(a.date));
    }

    return {
      status: 'success',
      data: { versions, changelogFile, sinceVersion: sinceVersion || null }
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/* node:coverage disable */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const sinceIndex = args.indexOf('--since');
  const sinceVersionIndex = args.indexOf('--since-version');
  const maxIndex = args.indexOf('--max');

  const sinceDate = sinceIndex !== -1 ? args[sinceIndex + 1] : new Date(Date.now() - 30 * 86400000).toISOString();
  const sinceVersion = sinceVersionIndex !== -1 ? args[sinceVersionIndex + 1] : undefined;
  const maxVersions = maxIndex !== -1 ? parseInt(args[maxIndex + 1], 10) : 10;

  const result = fetchChangelog(sinceDate, createDefaultDeps(), { maxVersions, sinceVersion });
  console.log(JSON.stringify(result, null, 2));
}
/* node:coverage enable */
