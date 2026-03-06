import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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
  getLastCostCommitDate
} from '../../../plugins/dev-workflow/lib/git-operations.js';

/**
 * git-operations integration tests
 *
 * Tests real git subprocess execution using the production git-operations.js functions.
 * Each test initializes a real git repository with proper setup/teardown.
 */

describe('lib/git-operations: integration tests', () => {
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
        { model: 'claude-sonnet-4-6', in: 100, out: 50, cost: 1.05 }
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
        { model: 'claude-opus-4-6', in: 10, out: 5, cost: 0.50 }
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

  describe("getLastCostCommitDate", () => {
    // Session IDs are path-derived with a leading dash, e.g. /Users/test/project → -Users-test-project
    const SESSION = '-Users-test-project';
    const OTHER_SESSION = '-Users-other-project';

    function makeTrailer(sessionId, costs = [{ model: 'claude-sonnet-4-6', in: 10, out: 5, cost: 0.10 }]) {
      return `Co-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: ${JSON.stringify({ sessionId, cost: costs })}`;
    }

    it('returns ISO 8601 date of most recent commit with matching sessionId', () => {
      stageFile(testEnv, 'file1.txt');
      commit(`Add file\n\n${makeTrailer(SESSION)}`, { cwd: testEnv.tmpDir });

      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.ok(typeof result === 'string', 'Should return a string');
      // Full ISO 8601 datetime with timezone, as produced by git %aI format.
      // Accepts both 'Z' (UTC, as seen in CI) and '±HH:MM' offset (local timezone).
      assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 'Should be full ISO 8601 datetime with timezone');
    });

    it('skips commits without cost trailer and returns date of older matching commit', () => {
      stageFile(testEnv, 'file1.txt');
      commit(`First\n\n${makeTrailer(SESSION)}`, { cwd: testEnv.tmpDir });

      const dateAfterFirst = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });

      stageFile(testEnv, 'file2.txt');
      commit('Ad-hoc commit without trailer', { cwd: testEnv.tmpDir });

      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.equal(result, dateAfterFirst, 'Should return date of older trailered commit, not the ad-hoc one');
    });

    it('skips commits with a different sessionId and returns date of matching commit', () => {
      stageFile(testEnv, 'file1.txt');
      commit(`Session A commit\n\n${makeTrailer(SESSION)}`, { cwd: testEnv.tmpDir });

      const dateAfterSessionA = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });

      stageFile(testEnv, 'file2.txt');
      commit(`Session B commit\n\n${makeTrailer(OTHER_SESSION)}`, { cwd: testEnv.tmpDir });

      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.equal(result, dateAfterSessionA, 'Should ignore commits from other session IDs');

      // Verify the inverse: OTHER_SESSION finds its own commit
      // Capture Session B's date directly — don't use notEqual, since git timestamps have
      // 1-second precision and both commits may land in the same second in a fast test env
      const sessionBLog = execGit(['log', '-1', '--format=%aI'], { cwd: testEnv.tmpDir });
      const sessionBDate = sessionBLog.stdout.trim();

      const resultOther = getLastCostCommitDate(OTHER_SESSION, { cwd: testEnv.tmpDir });
      assert.ok(resultOther !== null, 'OTHER_SESSION should find its commit');
      assert.equal(resultOther, sessionBDate, 'OTHER_SESSION should return its own commit date');
    });

    it('returns null when no commits have a matching trailer', () => {
      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.equal(result, null, 'Should return null when no matching trailer found');
    });

    it('returns null when cwd is not a git repo', () => {
      const result = getLastCostCommitDate(SESSION, { cwd: '/tmp' });
      assert.equal(result, null, 'Should return null for non-git directory');
    });

    it('skips commits with malformed JSON and continues searching', () => {
      stageFile(testEnv, 'file1.txt');
      commit(`Good commit\n\n${makeTrailer(SESSION)}`, { cwd: testEnv.tmpDir });

      const dateAfterGood = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });

      stageFile(testEnv, 'file2.txt');
      commit('Bad JSON commit\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: not-valid-json', { cwd: testEnv.tmpDir });

      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.equal(result, dateAfterGood, 'Should skip malformed JSON and find older valid commit');
    });

    it('skips commits with valid JSON but missing sessionId field', () => {
      stageFile(testEnv, 'file1.txt');
      commit(`Good commit\n\n${makeTrailer(SESSION)}`, { cwd: testEnv.tmpDir });

      const dateAfterGood = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });

      stageFile(testEnv, 'file2.txt');
      // Valid JSON but no sessionId key — distinct from wrong session and malformed JSON
      commit('No sessionId commit\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>\nClaude-Cost-Metrics: {"cost":[{"model":"claude-sonnet-4-6","cost":0.10}]}', { cwd: testEnv.tmpDir });

      const result = getLastCostCommitDate(SESSION, { cwd: testEnv.tmpDir });
      assert.equal(result, dateAfterGood, 'Should skip trailer with no sessionId and find older valid commit');
    });
  });
});
