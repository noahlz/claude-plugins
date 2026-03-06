import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import {
  readFileSafe,
  compilePattern,
  copyFile,
  ensureClaudeDir
} from '../../../plugins/dev-workflow/lib/file-utils.js';

describe('lib: file-utils.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('readFileSafe', () => {
    it('reads file content successfully', () => {
      const filePath = join(testEnv.tmpDir, 'test.txt');
      writeFileSync(filePath, 'hello world');

      const result = readFileSafe(filePath);
      assert.equal(result, 'hello world');
    });

    it('throws "Failed to read {label} at {path}" when file missing', () => {
      const missingPath = join(testEnv.tmpDir, 'missing.txt');
      const mockFs = {
        readFileSync: () => { throw new Error('ENOENT: no such file or directory'); }
      };

      assert.throws(
        () => readFileSafe(missingPath, { label: 'log file', fs: mockFs }),
        /Failed to read log file at .+missing\.txt/
      );
    });

    it('uses "file" as default label in error message', () => {
      const missingPath = join(testEnv.tmpDir, 'missing.txt');
      const mockFs = {
        readFileSync: () => { throw new Error('ENOENT: no such file or directory'); }
      };

      assert.throws(
        () => readFileSafe(missingPath, { fs: mockFs }),
        /Failed to read file at/
      );
    });
  });

  describe('compilePattern', () => {
    it('returns RegExp for valid pattern', () => {
      const regex = compilePattern('\\d+');
      assert.ok(regex instanceof RegExp);
      assert.ok(regex.test('123'));
      assert.equal(regex.flags, 'gm');
    });

    it('uses custom flags when provided', () => {
      const regex = compilePattern('hello', 'i');
      assert.equal(regex.flags, 'i');
    });

    it('throws "Invalid regex pattern" for invalid pattern', () => {
      assert.throws(
        () => compilePattern('[invalid'),
        /Invalid regex pattern "\[invalid"/
      );
    });
  });

  describe('copyFile', () => {
    it('copies file to destination', () => {
      const src = join(testEnv.tmpDir, 'src.txt');
      const dest = join(testEnv.tmpDir, 'dest.txt');
      writeFileSync(src, 'content');

      copyFile(src, dest);

      assert.ok(existsSync(dest));
    });

    it('creates destination directory when it does not exist', () => {
      const src = join(testEnv.tmpDir, 'src.txt');
      const dest = join(testEnv.tmpDir, 'newdir', 'nested', 'dest.txt');
      writeFileSync(src, 'content');

      copyFile(src, dest);

      assert.ok(existsSync(dest), 'File should exist in newly created directory');
    });
  });

  describe('ensureClaudeDir', () => {
    it('creates .claude dir when it does not exist', () => {
      const baseDir = join(testEnv.tmpDir, 'newbase');
      mkdirSync(baseDir, { recursive: true });

      const claudeDir = ensureClaudeDir(baseDir);

      assert.ok(existsSync(claudeDir), '.claude dir should be created');
    });

    it('returns path to .claude dir', () => {
      const claudeDir = ensureClaudeDir(testEnv.tmpDir);

      assert.ok(claudeDir.endsWith('.claude'), 'Should return path ending in .claude');
      assert.ok(existsSync(claudeDir));
    });

    it('does not fail when .claude dir already exists', () => {
      // setupTestEnv already creates .claude, so calling again should be idempotent
      assert.doesNotThrow(() => ensureClaudeDir(testEnv.tmpDir));
    });
  });
});
