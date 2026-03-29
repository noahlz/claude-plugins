import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchChangelog } from '../../../plugins/dev-workflow/skills/check-claude-changelog/scripts/fetch-changelog.js';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

// All commit dates (March 15, 20) are after SINCE_DATE so they pass the filter
const SINCE_DATE = '2026-03-01T00:00:00Z';

const COMMITS_TSV = [
  'abc123\t2026-03-15T10:00:00Z',
  'def456\t2026-03-20T12:00:00Z',
].join('\n');

const PATCH_V2_1_87 = '+## 2.1.87\n+Some changelog text\n context line\n';
const PATCH_V2_1_88 = '+## 2.1.88\n+Another changelog entry\n context line\n';
const RAW_CHANGELOG = '# Changelog\n\n## 2.1.88\n\nAnother entry.\n\n## 2.1.87\n\nSome content here.\n';

/**
 * Routes exec() calls to handler functions or values by substring matching.
 * Unlike the per-method mock factories in commit-with-costs/helpers.js, this
 * uses substring routing because fetch-changelog funnels all calls through a
 * single deps.exec(cmd) — the command string is the only dispatch surface.
 * If a handler is an Error, it is thrown. Functions receive the full command.
 */
function createMockDeps(handlers) {
  return {
    exec: (cmd) => {
      for (const [pattern, handler] of Object.entries(handlers)) {
        if (cmd.includes(pattern)) {
          if (handler instanceof Error) throw handler;
          return typeof handler === 'function' ? handler(cmd) : handler;
        }
      }
      throw new Error(`Unmocked command: ${cmd}`);
    }
  };
}

describe('check-claude-changelog: fetch-changelog.js unit tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('success cases', () => {
    it('fetches version history and raw changelog since a given date', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': PATCH_V2_1_87,
        'commits/def456': PATCH_V2_1_88,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 2);
      // Sorted newest-first: def456 (March 20) before abc123 (March 15)
      assert.deepEqual(result.data.versions[0], {
        version: '2.1.88',
        date: '2026-03-20T12:00:00Z',
        dateShort: '2026-03-20'
      });
      assert.deepEqual(result.data.versions[1], {
        version: '2.1.87',
        date: '2026-03-15T10:00:00Z',
        dateShort: '2026-03-15'
      });
      assert.equal(result.data.changelogRaw, RAW_CHANGELOG);
    });

    it('returns empty versions array when all commits predate sinceDate', () => {
      const oldCommitsTsv = [
        'aaa111\t2026-02-01T10:00:00Z',
        'bbb222\t2026-02-15T10:00:00Z',
      ].join('\n');

      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': oldCommitsTsv,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.versions, []);
      assert.equal(result.data.changelogRaw, RAW_CHANGELOG);
    });

    it('skips commits whose patch fetch fails and returns remaining versions', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': new Error('API rate limit exceeded'),
        'commits/def456': PATCH_V2_1_88,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 1);
      assert.equal(result.data.versions[0].version, '2.1.88');
    });

    it('includes commits exactly on the sinceDate boundary', () => {
      const boundaryCommits = 'bbb222\t2026-03-01T00:00:00Z';
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': boundaryCommits,
        'commits/bbb222': PATCH_V2_1_87,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 1);
      assert.equal(result.data.versions[0].version, '2.1.87');
    });

    it('skips commits whose patch contains no +## version line', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': ' context line\n-removed line\n',
        'commits/def456': ' context line\n-removed line\n',
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.versions, []);
    });
  });

  describe('error cases', () => {
    it('returns error status with install URL when gh is not installed', () => {
      const deps = createMockDeps({
        'gh --version': new Error('command not found: gh'),
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /https:\/\/cli\.github\.com/);
    });

    it('returns error status when commits API returns empty string', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': '',
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /No commits found/);
    });

    it('returns error status when curl fails', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': PATCH_V2_1_87,
        'commits/def456': PATCH_V2_1_88,
        'curl': new Error('curl: (6) Could not resolve host'),
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /Failed to fetch changelog/);
    });
  });

  describe('parameter validation', () => {
    it('throws when deps is null', () => {
      assert.throws(
        () => fetchChangelog(SINCE_DATE, null),
        { name: 'Error', message: /deps parameter required/ }
      );
    });

    it('throws when sinceDate is null', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': PATCH_V2_1_87,
        'commits/def456': PATCH_V2_1_88,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(null, deps);

      // With null sinceDate, no commits pass the >= filter
      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 0);
    });
  });

  describe('options', () => {
    it('includes maxVersions in the gh api per_page query parameter', () => {
      let capturedCmd = '';

      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': (cmd) => {
          capturedCmd = cmd;
          return COMMITS_TSV;
        },
        'commits/abc123': PATCH_V2_1_87,
        'commits/def456': PATCH_V2_1_88,
        'curl': RAW_CHANGELOG,
      });

      fetchChangelog(SINCE_DATE, deps, { maxVersions: 25 });

      assert.match(capturedCmd, /per_page=25/);
    });
  });
});
