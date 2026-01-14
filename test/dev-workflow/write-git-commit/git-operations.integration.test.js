import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execGit
} from '../../lib/helpers.js';
import {
  execGit as prodExecGit,
  commit,
  getHeadSha,
} from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/git-operations.js';

/**
 * git-operations integration tests
 *
 * Tests real git subprocess execution using the production git-operations.js functions.
 * Each test initializes a real git repository with proper setup/teardown.
 */

describe('git-operations: integration tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();

    // Initialize real git repo for testing
    execGit(['init'], { cwd: testEnv.tmpDir });
    execGit(['config', 'user.email', 'test@example.com'], { cwd: testEnv.tmpDir });
    execGit(['config', 'user.name', 'Test User'], { cwd: testEnv.tmpDir });

    // Create initial commit
    writeFileSync(join(testEnv.tmpDir, 'initial.txt'), 'initial');
    execGit(['add', 'initial.txt'], { cwd: testEnv.tmpDir });
    execGit(['commit', '-m', 'initial commit'], { cwd: testEnv.tmpDir });
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
      // Create a file in the test directory
      writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');

      // Verify cwd is respected by checking file exists
      const resultWithCwd = prodExecGit(['ls-files'], { cwd: testEnv.tmpDir });
      assert.equal(resultWithCwd.exitCode, 0, 'Should succeed with specified cwd');
      assert.ok(resultWithCwd.stdout.includes('initial.txt'), 'Should list files from cwd');
    });
  });

  describe("commit", () => {
    it('creates commit with message', () => {
      // Stage a file
      writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
      execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

      const result = commit('Add test file', { cwd: testEnv.tmpDir });

      assert.equal(result.exitCode, 0, 'Should succeed with valid staged changes');

      // Verify commit was created
      const logResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });
      assert.ok(logResult.stdout.includes('Add test file'), 'Commit message should be present');
    });

    it('handles multi-line messages with body', () => {
      // Stage a file
      writeFileSync(join(testEnv.tmpDir, 'feature.txt'), 'feature');
      execGit(['add', 'feature.txt'], { cwd: testEnv.tmpDir });

      const multilineMessage = 'Add new feature\n\n- Implemented core functionality\n- Added unit tests\n- Updated documentation';
      const result = commit(multilineMessage, { cwd: testEnv.tmpDir });

      assert.equal(result.exitCode, 0, 'Should succeed with multi-line message');

      // Verify full message is preserved
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
      // Create two test directories with git repos
      const dir2 = join(testEnv.tmpDir, 'dir2');
      mkdirSync(dir2, { recursive: true });

      // Initialize second repo
      execGit(['init'], { cwd: dir2 });
      execGit(['config', 'user.email', 'test@example.com'], { cwd: dir2 });
      execGit(['config', 'user.name', 'Test User'], { cwd: dir2 });
      writeFileSync(join(dir2, 'initial.txt'), 'initial');
      execGit(['add', 'initial.txt'], { cwd: dir2 });
      execGit(['commit', '-m', 'initial'], { cwd: dir2 });

      // Stage file in dir2
      writeFileSync(join(dir2, 'test.txt'), 'test');
      execGit(['add', 'test.txt'], { cwd: dir2 });

      // Commit in dir2
      const result = commit('Test commit in dir2', { cwd: dir2 });
      assert.equal(result.exitCode, 0, 'Should succeed in specified cwd');

      // Verify commit is in dir2, not testEnv.tmpDir
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

      // Verify it matches git log
      const logResult = execGit(['log', '-1', '--format=%H'], { cwd: testEnv.tmpDir });
      assert.equal(sha, logResult.stdout.trim(), 'Should match git log output');
    });

    it('returns 40-character hex string', () => {
      const sha = getHeadSha({ cwd: testEnv.tmpDir });

      assert.match(sha, /^[0-9a-f]{40}$/, 'SHA should be 40 hex characters');
    });
  });
});
