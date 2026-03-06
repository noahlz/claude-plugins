import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import {
  readFileSafe,
  compilePattern
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
});
