import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  setupTestEnv,
  teardownTestEnv,
  setupGitRepo,
  stageFile,
  execGit
} from './helpers.js';
import {
  execGit as prodExecGit,
  commit,
  getHeadSha,
  getPreviousCostMetrics,
  getLastCommitDate
} from '../../../plugins/dev-workflow/lib/git-operations.js';

/**
 * git-operations integration tests (commit-with-costs context)
 *
 * Tests real git subprocess execution using the production lib/git-operations.js functions.
 * Each test initializes a real git repository with proper setup/teardown.
 */

describe('commit-with-costs/git-operations: integration tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
    setupGitRepo(testEnv);
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe("execGit", () => {
    it('executes git commands successfully', () => {
      const result = prodExecGit(['status'], { cwd: testEnv.tmpDir });

      assert.equal(result.exitCode, 0, 'Should succeed with exit code 0');
      assert.ok(typeof result.stdout === 'string', 'Should return stdout as string');
      assert.ok(result.stdout.includes('On branch'), 'Should contain branch info');
    });

    it('returns error when command fails', () => {
      const result = prodExecGit(['commit', '-m', 'empty commit'], { cwd: testEnv.tmpDir });

      assert.notEqual(result.exitCode, 0, 'Should fail with non-zero exit code');
      assert.ok(typeof result.stderr === 'string', 'Should return stderr as string');
      assert.ok(result.stderr.length > 0, 'Should have error message');
    });

    it('respects cwd option', () => {
      writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');

      const resultWithCwd = prodExecGit(['ls-files'], { cwd: testEnv.tmpDir });
      assert.equal(resultWithCwd.exitCode, 0, 'Should succeed with specified cwd');
      assert.ok(resultWithCwd.stdout.includes('initial.txt'), 'Should list files from cwd');
    });
  });

  describe("commit", () => {
    it('creates commit with message', () => {
      stageFile(testEnv, 'test.txt');

      const result = commit('Add test file', { cwd: testEnv.tmpDir });

      assert.equal(result.exitCode, 0, 'Should succeed with valid staged changes');

      const logResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });
      assert.ok(logResult.stdout.includes('Add test file'), 'Commit message should be present');
    });

    it('handles multi-line messages with body', () => {
      stageFile(testEnv, 'feature.txt', 'feature');

      const multilineMessage = 'Add new feature\n\n- Implemented core functionality\n- Added unit tests\n- Updated documentation';
      const result = commit(multilineMessage, { cwd: testEnv.tmpDir });

      assert.equal(result.exitCode, 0, 'Should succeed with multi-line message');

      const logResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });
      assert.ok(logResult.stdout.includes('Add new feature'), 'Should contain subject');
      assert.ok(logResult.stdout.includes('- Implemented core functionality'), 'Should contain first bullet');
      assert.ok(logResult.stdout.includes('- Added unit tests'), 'Should contain second bullet');
      assert.ok(logResult.stdout.includes('- Updated documentation'), 'Should contain third bullet');
    });

    it('fails when nothing is staged', () => {
      const result = commit('Empty commit', { cwd: testEnv.tmpDir });

      assert.notEqual(result.exitCode, 0, 'Should fail when nothing is staged');
    });

    it('respects cwd option', () => {
      const dir2 = join(testEnv.tmpDir, 'dir2');
      mkdirSync(dir2, { recursive: true });

      execGit(['init'], { cwd: dir2 });
      execGit(['config', 'user.email', 'test@example.com'], { cwd: dir2 });
      execGit(['config', 'user.name', 'Test User'], { cwd: dir2 });
      writeFileSync(join(dir2, 'initial.txt'), 'initial');
      execGit(['add', 'initial.txt'], { cwd: dir2 });
      execGit(['commit', '-m', 'initial'], { cwd: dir2 });

      writeFileSync(join(dir2, 'test.txt'), 'test');
      execGit(['add', 'test.txt'], { cwd: dir2 });

      const result = commit('Test commit in dir2', { cwd: dir2 });
      assert.equal(result.exitCode, 0, 'Should succeed in specified cwd');

      const logDir1 = execGit(['log', '--oneline'], { cwd: testEnv.tmpDir });
      const logDir2 = execGit(['log', '--oneline'], { cwd: dir2 });

      assert.ok(logDir1.stdout.split('\n').length <= 2, 'Dir1 should have only initial commit');
      assert.ok(logDir2.stdout.split('\n').length > 2, 'Dir2 should have new commit');
    });
  });

  describe("getHeadSha", () => {
    it('returns current commit SHA', () => {
      const sha = getHeadSha({ cwd: testEnv.tmpDir });

      assert.ok(typeof sha === 'string', 'Should return SHA as string');
      assert.ok(sha.length > 0, 'SHA should not be empty');

      const logResult = execGit(['log', '-1', '--format=%H'], { cwd: testEnv.tmpDir });
      assert.equal(sha, logResult.stdout.trim(), 'Should match git log output');
    });

    it('returns 40-character hex string', () => {
      const sha = getHeadSha({ cwd: testEnv.tmpDir });

      assert.match(sha, /^[0-9a-f]{40}$/, 'SHA should be 40 hex characters');
    });
  });

  describe("getPreviousCostMetrics", () => {
    it('returns empty array when no commits have trailer', () => {
      const result = getPreviousCostMetrics({ cwd: testEnv.tmpDir });
      assert.deepEqual(result, []);
    });

    it('returns cost array from most recent commit with trailer', () => {
      const costs = [
        { model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 50, cost: 1.05 }
      ];
      // Use two trailer lines (like real commits) to ensure git recognizes the trailer block
      const trailers = `Co-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: ${JSON.stringify({ sessionId: 'test', cost: costs })}`;
      stageFile(testEnv, 'file1.txt');
      commit(`Add file\n\n${trailers}`, { cwd: testEnv.tmpDir });

      const result = getPreviousCostMetrics({ cwd: testEnv.tmpDir });
      assert.deepEqual(result, costs);
    });

    it('skips commits with malformed JSON and returns empty array', () => {
      stageFile(testEnv, 'file1.txt');
      commit('Add file\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: not-valid-json', { cwd: testEnv.tmpDir });

      const result = getPreviousCostMetrics({ cwd: testEnv.tmpDir });
      assert.deepEqual(result, []);
    });

    it('skips JSON without cost array and returns empty array', () => {
      stageFile(testEnv, 'file1.txt');
      commit('Add file\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: {"sessionId":"x","other":"field"}', { cwd: testEnv.tmpDir });

      const result = getPreviousCostMetrics({ cwd: testEnv.tmpDir });
      assert.deepEqual(result, []);
    });

    it('finds trailer in older commit when most recent has none', () => {
      const costs = [
        { model: 'claude-opus-4-6', inputTokens: 10, outputTokens: 5, cost: 0.50 }
      ];
      const trailers = `Co-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: ${JSON.stringify({ sessionId: 'test', cost: costs })}`;

      stageFile(testEnv, 'file1.txt');
      commit(`First\n\n${trailers}`, { cwd: testEnv.tmpDir });

      stageFile(testEnv, 'file2.txt');
      commit('Second commit without trailer', { cwd: testEnv.tmpDir });

      const result = getPreviousCostMetrics({ cwd: testEnv.tmpDir });
      assert.deepEqual(result, costs);
    });

    it('returns empty array when cwd is not a git repo', () => {
      const result = getPreviousCostMetrics({ cwd: '/tmp' });
      assert.deepEqual(result, []);
    });
  });

  describe("getLastCommitDate", () => {
    it('returns ISO 8601 date string after first commit', () => {
      const result = getLastCommitDate({ cwd: testEnv.tmpDir });
      assert.ok(typeof result === 'string', 'Should return a string');
      // ISO 8601 format: starts with 4-digit year, dash, 2-digit month, dash, 2-digit day, T
      assert.match(result, /^\d{4}-\d{2}-\d{2}T/, 'Should be ISO 8601 format');
    });

    it('returns null for empty repository with no commits', () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'empty-repo-'));
      execGit(['init'], { cwd: emptyDir });

      const result = getLastCommitDate({ cwd: emptyDir });
      assert.equal(result, null, 'Should return null when no commits exist');

      rmSync(emptyDir, { recursive: true, force: true });
    });

    it('returns null when cwd is not a git repo', () => {
      const result = getLastCommitDate({ cwd: '/tmp' });
      assert.equal(result, null, 'Should return null for non-git directory');
    });
  });
});
