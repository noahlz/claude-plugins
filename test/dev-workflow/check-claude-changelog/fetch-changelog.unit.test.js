import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchChangelog } from '../../../plugins/dev-workflow/skills/check-claude-changelog/scripts/fetch-changelog.js';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

const SINCE_DATE = '2026-03-01T00:00:00Z';

// Mock GitHub API responses as JSON strings (what curl returns)
const COMMITS_JSON = JSON.stringify([
  { sha: 'abc123', commit: { author: { date: '2026-03-15T10:00:00Z' } } },
  { sha: 'def456', commit: { author: { date: '2026-03-20T12:00:00Z' } } },
]);

const COMMIT_DETAIL_V2_1_87 = JSON.stringify({
  files: [{ patch: '+## 2.1.87\n+Some changelog text\n context line\n' }]
});

const COMMIT_DETAIL_V2_1_88 = JSON.stringify({
  files: [{ patch: '+## 2.1.88\n+Another changelog entry\n context line\n' }]
});

// Commit detail with no version in the patch
const COMMIT_DETAIL_NO_VERSION = JSON.stringify({
  files: [{ patch: ' context line\n-removed line\n' }]
});

const RAW_CHANGELOG = '# Changelog\n\n## 2.1.88\n\nAnother entry.\n\n## 2.1.87\n\nSome content here.\n';

/**
 * Routes exec() calls to handler functions or values by substring matching.
 * Handlers that are Error instances are thrown. Functions receive the full command.
 */
function createMockDeps(handlers, testEnv) {
  let writtenFile = null;
  let writtenContent = null;
  return {
    exec: (cmd) => {
      for (const [pattern, handler] of Object.entries(handlers)) {
        if (cmd.includes(pattern)) {
          if (handler instanceof Error) throw handler;
          return typeof handler === 'function' ? handler(cmd) : handler;
        }
      }
      throw new Error(`Unmocked command: ${cmd}`);
    },
    writeFile: (path, content) => { writtenFile = path; writtenContent = content; },
    tmpdir: () => testEnv?.tmpDir ?? '/tmp',
    get writtenFile() { return writtenFile; },
    get writtenContent() { return writtenContent; },
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
    it('fetches version history and writes changelog to temp file', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': COMMITS_JSON,
        'commits/abc123': COMMIT_DETAIL_V2_1_87,
        'commits/def456': COMMIT_DETAIL_V2_1_88,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

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
      assert.ok(result.data.changelogFile.startsWith(testEnv.tmpDir),
        `expected path under test tmpDir, got ${result.data.changelogFile}`);
      assert.match(result.data.changelogFile, /claude-changelog-/);
      assert.equal(deps.writtenContent, RAW_CHANGELOG);
    });

    it('returns empty versions array when all commits predate sinceDate', () => {
      const oldCommitsJson = JSON.stringify([
        { sha: 'aaa111', commit: { author: { date: '2026-02-01T10:00:00Z' } } },
        { sha: 'bbb222', commit: { author: { date: '2026-02-15T10:00:00Z' } } },
      ]);

      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': oldCommitsJson,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.versions, []);
      assert.ok(result.data.changelogFile.startsWith(testEnv.tmpDir));
      assert.equal(deps.writtenContent, RAW_CHANGELOG);
    });

    it('skips commits whose detail fetch fails and returns remaining versions', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': COMMITS_JSON,
        'commits/abc123': new Error('API rate limit exceeded'),
        'commits/def456': COMMIT_DETAIL_V2_1_88,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 1);
      assert.equal(result.data.versions[0].version, '2.1.88');
    });

    it('includes commits exactly on the sinceDate boundary', () => {
      const boundaryJson = JSON.stringify([
        { sha: 'bbb222', commit: { author: { date: '2026-03-01T00:00:00Z' } } },
      ]);

      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': boundaryJson,
        'commits/bbb222': COMMIT_DETAIL_V2_1_87,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 1);
      assert.equal(result.data.versions[0].version, '2.1.87');
    });

    it('skips commits whose patch contains no +## version line', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': COMMITS_JSON,
        'commits/abc123': COMMIT_DETAIL_NO_VERSION,
        'commits/def456': COMMIT_DETAIL_NO_VERSION,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.versions, []);
    });
  });

  describe('error cases', () => {
    it('returns error when commits API fetch fails', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': new Error('curl: (6) Could not resolve host'),
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /Failed to fetch commits/);
    });

    it('returns error when commits API returns empty array', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': '[]',
      }, testEnv);

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /No commits found/);
    });

    it('returns error when raw changelog fetch fails', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': COMMITS_JSON,
        'commits/abc123': COMMIT_DETAIL_V2_1_87,
        'commits/def456': COMMIT_DETAIL_V2_1_88,
        'CHANGELOG.md': new Error('curl: (6) Could not resolve host'),
      }, testEnv);

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

    it('returns empty versions when sinceDate is null (no commits pass filter)', () => {
      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': COMMITS_JSON,
        'commits/abc123': COMMIT_DETAIL_V2_1_87,
        'commits/def456': COMMIT_DETAIL_V2_1_88,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      const result = fetchChangelog(null, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.versions.length, 0);
    });
  });

  describe('options', () => {
    it('includes maxVersions in the curl per_page query parameter', () => {
      let capturedCmd = '';

      const deps = createMockDeps({
        'commits?path=CHANGELOG.md': (cmd) => {
          capturedCmd = cmd;
          return COMMITS_JSON;
        },
        'commits/abc123': COMMIT_DETAIL_V2_1_87,
        'commits/def456': COMMIT_DETAIL_V2_1_88,
        'CHANGELOG.md': RAW_CHANGELOG,
      }, testEnv);

      fetchChangelog(SINCE_DATE, deps, { maxVersions: 25 });

      assert.match(capturedCmd, /per_page=25/);
    });
  });
});
