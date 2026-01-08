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
  getStagedFiles
} from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/git-operations.js';

/**
 * git-operations integration tests
 *
 * Tests real git subprocess execution using the production git-operations.js functions.
 * Each test initializes a real git repository with proper setup/teardown.
 * No mocking - validates actual git behavior and subprocess handling.
 */

describe('git-operations: integration tests (real git)', () => {
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

  // ====== execGit() - 3 tests ======

  it('execGit executes git commands successfully', () => {
    const result = prodExecGit(['status'], { cwd: testEnv.tmpDir });

    assert.equal(result.exitCode, 0, 'Should succeed with exit code 0');
    assert.ok(typeof result.stdout === 'string', 'Should return stdout as string');
    assert.ok(result.stdout.includes('On branch'), 'Should contain branch info');
  });

  it('execGit returns error when command fails', () => {
    const result = prodExecGit(['commit', '-m', 'empty commit'], { cwd: testEnv.tmpDir });

    assert.notEqual(result.exitCode, 0, 'Should fail with non-zero exit code');
    assert.ok(typeof result.stderr === 'string', 'Should return stderr as string');
    assert.ok(result.stderr.length > 0, 'Should have error message');
  });

  it('execGit respects cwd option', () => {
    // Create a file in the test directory
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');

    // Verify cwd is respected by checking file exists
    const resultWithCwd = prodExecGit(['ls-files'], { cwd: testEnv.tmpDir });
    assert.equal(resultWithCwd.exitCode, 0, 'Should succeed with specified cwd');
    assert.ok(resultWithCwd.stdout.includes('initial.txt'), 'Should list files from cwd');
  });

  // ====== commit() - 4 tests ======

  it('commit creates commit with message', () => {
    // Stage a file
    writeFileSync(join(testEnv.tmpDir, 'test.txt'), 'test content');
    execGit(['add', 'test.txt'], { cwd: testEnv.tmpDir });

    const result = commit('Add test file', { cwd: testEnv.tmpDir });

    assert.equal(result.exitCode, 0, 'Should succeed with valid staged changes');

    // Verify commit was created
    const logResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });
    assert.ok(logResult.stdout.includes('Add test file'), 'Commit message should be present');
  });

  it('commit handles multi-line messages with body', () => {
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

  it('commit fails when nothing is staged', () => {
    const result = commit('Empty commit', { cwd: testEnv.tmpDir });

    assert.notEqual(result.exitCode, 0, 'Should fail when nothing is staged');
  });

  it('commit respects cwd option', () => {
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

  // ====== getHeadSha() - 2 tests ======

  it('getHeadSha returns current commit SHA', () => {
    const sha = getHeadSha({ cwd: testEnv.tmpDir });

    assert.ok(typeof sha === 'string', 'Should return SHA as string');
    assert.ok(sha.length > 0, 'SHA should not be empty');

    // Verify it matches git log
    const logResult = execGit(['log', '-1', '--format=%H'], { cwd: testEnv.tmpDir });
    assert.equal(sha, logResult.stdout.trim(), 'Should match git log output');
  });

  it('getHeadSha returns 40-character hex string', () => {
    const sha = getHeadSha({ cwd: testEnv.tmpDir });

    assert.match(sha, /^[0-9a-f]{40}$/, 'SHA should be 40 hex characters');
  });

  // ====== getStagedFiles() - 3 tests ======

  it('getStagedFiles returns empty array when nothing staged', () => {
    const files = getStagedFiles({ cwd: testEnv.tmpDir });

    assert.ok(Array.isArray(files), 'Should return an array');
    assert.equal(files.length, 0, 'Should be empty when nothing staged');
  });

  it('getStagedFiles returns staged file names', () => {
    // Stage a single file
    writeFileSync(join(testEnv.tmpDir, 'test1.txt'), 'content1');
    execGit(['add', 'test1.txt'], { cwd: testEnv.tmpDir });

    const files = getStagedFiles({ cwd: testEnv.tmpDir });

    assert.ok(Array.isArray(files), 'Should return an array');
    assert.equal(files.length, 1, 'Should have one staged file');
    assert.equal(files[0], 'test1.txt', 'Should contain file name');
  });

  it('getStagedFiles returns multiple files', () => {
    // Stage multiple files
    writeFileSync(join(testEnv.tmpDir, 'file1.txt'), 'content1');
    writeFileSync(join(testEnv.tmpDir, 'file2.txt'), 'content2');
    writeFileSync(join(testEnv.tmpDir, 'file3.txt'), 'content3');

    execGit(['add', 'file1.txt'], { cwd: testEnv.tmpDir });
    execGit(['add', 'file2.txt'], { cwd: testEnv.tmpDir });
    execGit(['add', 'file3.txt'], { cwd: testEnv.tmpDir });

    const files = getStagedFiles({ cwd: testEnv.tmpDir });

    assert.ok(Array.isArray(files), 'Should return an array');
    assert.equal(files.length, 3, 'Should have three staged files');
    assert.ok(files.includes('file1.txt'), 'Should contain file1.txt');
    assert.ok(files.includes('file2.txt'), 'Should contain file2.txt');
    assert.ok(files.includes('file3.txt'), 'Should contain file3.txt');
  });
});
