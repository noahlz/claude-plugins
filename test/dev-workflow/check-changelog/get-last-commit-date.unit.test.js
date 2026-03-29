import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { getLastCommitDate } from '../../../plugins/dev-workflow/skills/check-changelog/scripts/get-last-commit-date.js';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

/**
 * Create a mock deps object with a git.execGit stub returning the given result.
 * @param {{ stdout?: string, stderr?: string, exitCode?: number }} gitResult
 * @returns {{ git: { execGit: Function } }}
 */
function createMockDeps(gitResult) {
  return {
    git: {
      execGit: (_args, _options) => gitResult
    }
  };
}

describe('check-changelog: get-last-commit-date.js unit tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('success cases', () => {
    it('returns correct data fields for valid git output', () => {
      const deps = createMockDeps({
        exitCode: 0,
        stdout: '2026-03-15T10:30:00-05:00\nabc1234\nAdd feature X\n',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.date, '2026-03-15T10:30:00-05:00');
      assert.equal(result.data.dateShort, '2026-03-15');
      assert.equal(result.data.sha, 'abc1234');
      assert.equal(result.data.message, 'Add feature X');
    });

    it('extracts dateShort as first 10 characters of ISO date', () => {
      const deps = createMockDeps({
        exitCode: 0,
        stdout: '2025-12-01T00:00:00+00:00\ndeadbeef\nFix bug\n',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.dateShort, '2025-12-01');
    });

    it('returns empty string for message when subject line is empty', () => {
      const deps = createMockDeps({
        exitCode: 0,
        stdout: '2026-03-15T10:30:00-05:00\nabc1234\n\n',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.message, '');
    });
  });

  describe('error cases', () => {
    it('returns error status when exitCode is non-zero with stderr', () => {
      const deps = createMockDeps({
        exitCode: 128,
        stdout: '',
        stderr: 'fatal: your current branch has no commits yet'
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /no commits/);
    });

    it('returns error status when not a git repository', () => {
      const deps = createMockDeps({
        exitCode: 128,
        stdout: '',
        stderr: 'fatal: not a git repository (or any of the parent directories): .git'
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /not a git repository/);
    });

    it('returns error with fallback message when exitCode is non-zero and stderr is empty', () => {
      const deps = createMockDeps({
        exitCode: 1,
        stdout: '',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'error');
      assert.equal(result.error, 'No commits found or git command failed');
    });

    it('returns error when exitCode is 0 but stdout is empty', () => {
      const deps = createMockDeps({
        exitCode: 0,
        stdout: '',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'error');
      assert.equal(result.error, 'No commits found or git command failed');
    });

    it('returns error when output has only one line (missing sha)', () => {
      const deps = createMockDeps({
        exitCode: 0,
        stdout: '2026-03-15T10:30:00-05:00\n',
        stderr: ''
      });

      const result = getLastCommitDate(deps);

      assert.equal(result.status, 'error');
      assert.equal(result.error, 'Unexpected git output format');
    });
  });

  describe('parameter validation', () => {
    it('throws when deps is null', () => {
      assert.throws(
        () => getLastCommitDate(null),
        /deps parameter required/
      );
    });

    it('throws when deps is undefined', () => {
      assert.throws(
        () => getLastCommitDate(undefined),
        /deps parameter required/
      );
    });
  });

  describe('options forwarding', () => {
    it('passes options through to execGit', () => {
      const capturedArgs = {};
      const deps = {
        git: {
          execGit: (args, options) => {
            capturedArgs.args = args;
            capturedArgs.options = options;
            return {
              exitCode: 0,
              stdout: '2026-03-15T10:30:00-05:00\nabc1234\nTest commit\n',
              stderr: ''
            };
          }
        }
      };

      const options = { cwd: '/some/repo' };
      getLastCommitDate(deps, options);

      assert.deepEqual(capturedArgs.options, options);
    });
  });
});
