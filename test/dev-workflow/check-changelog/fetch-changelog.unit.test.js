import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchChangelog } from '../../../plugins/dev-workflow/skills/check-changelog/scripts/fetch-changelog.js';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

const SINCE_DATE = '2026-03-01T00:00:00Z';

const COMMITS_TSV = [
  'abc123\t2026-03-15T10:00:00Z',
  'def456\t2026-03-20T12:00:00Z',
].join('\n');

const PATCH_WITH_VERSION = '+## 2.1.87\n+Some changelog text\n context line\n';
const RAW_CHANGELOG = '# Changelog\n\n## 2.1.87\n\nSome content here.\n';

/**
 * Routes exec() calls to handler functions or values by substring matching.
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

describe('check-changelog: fetch-changelog.js unit tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('success cases', () => {
    it('returns versions array and changelogRaw on valid mock output', () => {
      const deps = createMockDeps({
        'gh --version': 'gh version 2.45.0',
        'commits?path=CHANGELOG.md': COMMITS_TSV,
        'commits/abc123': PATCH_WITH_VERSION,
        'commits/def456': PATCH_WITH_VERSION,
        'curl': RAW_CHANGELOG,
      });

      const result = fetchChangelog(SINCE_DATE, deps);

      assert.equal(result.status, 'success');
      assert.ok(Array.isArray(result.data.versions));
      assert.ok(result.data.versions.length > 0);
      assert.equal(result.data.versions[0].version, '2.1.87');
      assert.ok(result.data.versions[0].date);
      assert.ok(result.data.versions[0].dateShort);
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
        'commits/abc123': PATCH_WITH_VERSION,
        'commits/def456': PATCH_WITH_VERSION,
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
        /deps parameter required/
      );
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
        'commits/abc123': PATCH_WITH_VERSION,
        'commits/def456': PATCH_WITH_VERSION,
        'curl': RAW_CHANGELOG,
      });

      fetchChangelog(SINCE_DATE, deps, { maxVersions: 25 });

      assert.match(capturedCmd, /per_page=25/);
    });
  });
});
