import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import { parseJsonFile } from '../../../plugins/dev-workflow/lib/config-loader.js';

describe('lib: config-loader.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('parseJsonFile', () => {
    it('returns null when file does not exist', () => {
      const result = parseJsonFile(join(testEnv.tmpDir, 'nonexistent.json'));
      assert.equal(result, null);
    });

    it('parses valid JSON file', () => {
      const filePath = join(testEnv.tmpDir, 'valid.json');
      writeFileSync(filePath, JSON.stringify({ key: 'value' }));
      const result = parseJsonFile(filePath);
      assert.deepStrictEqual(result, { key: 'value' });
    });

    it('throws when JSON file contains invalid JSON', () => {
      const filePath = join(testEnv.tmpDir, 'bad.json');
      writeFileSync(filePath, '{ not valid json }');
      assert.throws(
        () => parseJsonFile(filePath),
        /Invalid JSON in/
      );
    });
  });
});
