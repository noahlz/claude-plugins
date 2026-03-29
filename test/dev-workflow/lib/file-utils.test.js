import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import {
  readFileSafe,
  readSessionConfig,
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

  describe('readSessionConfig', () => {
    it('returns full parsed config object with sessionId', () => {
      const configPath = join(testEnv.tmpDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({ sessionId: '-Users-test-project' }));

      const config = readSessionConfig(configPath);
      assert.deepStrictEqual(config, { sessionId: '-Users-test-project' });
    });

    it('throws when file does not exist', () => {
      const missingPath = join(testEnv.tmpDir, 'missing-config.json');

      assert.throws(
        () => readSessionConfig(missingPath),
        /Failed to read skill config at/
      );
    });

    it('throws SyntaxError on invalid JSON', () => {
      const configPath = join(testEnv.tmpDir, 'bad.json');
      writeFileSync(configPath, 'not json');

      assert.throws(
        () => readSessionConfig(configPath),
        { name: 'SyntaxError' }
      );
    });

    it('throws when sessionId field is missing', () => {
      const configPath = join(testEnv.tmpDir, 'empty-config.json');
      writeFileSync(configPath, JSON.stringify({ otherField: 'value' }));

      assert.throws(
        () => readSessionConfig(configPath),
        /missing sessionId field/
      );
    });

    it('throws when sessionId is empty string', () => {
      const configPath = join(testEnv.tmpDir, 'empty-id.json');
      writeFileSync(configPath, JSON.stringify({ sessionId: '' }));

      assert.throws(
        () => readSessionConfig(configPath),
        /missing sessionId field/
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
