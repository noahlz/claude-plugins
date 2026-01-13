import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseTestFailures } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-test-failures.js';
import { createMockFs } from './helpers.js';

describe('run-and-fix-tests: parse-test-failures.js', () => {
  describe('parsing', () => {
    it('parses test results and counts failures', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'test-results.tap',
            errorPattern: 'not ok \\d+ - .*'
          }
        }
      };

      const resultsContent = `
TAP version 13
1..5
ok 1 - test passes
not ok 2 - should validate input
not ok 3 - should handle errors correctly
ok 4 - another passing test
not ok 5 - final failing test
`;

      const mockFs = createMockFs(resultsContent);
      const result = parseTestFailures(config, { deps: { fs: mockFs } });

      assert.equal(result.failures.length, 3, 'Should extract 3 failures');
      assert.equal(result.totalFailures, 3, 'Should count 3 total failures');
      assert.equal(result.truncated, false, 'Should not be truncated');

      assert.equal(result.failures[0].test, 'should validate input', 'Should extract test name');
      assert.match(result.failures[0].message, /not ok 2/, 'Should include full failure text');
    });

    it('returns zero count when all tests pass', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'test-results.tap',
            errorPattern: 'not ok'
          }
        }
      };

      const resultsContent = `
TAP version 13
1..3
ok 1 - test one
ok 2 - test two
ok 3 - test three
`;

      const mockFs = createMockFs(resultsContent);
      const result = parseTestFailures(config, { deps: { fs: mockFs } });

      assert.equal(result.failures.length, 0, 'Should return empty array');
      assert.equal(result.totalFailures, 0, 'Should count 0 failures');
      assert.equal(result.truncated, false, 'Should not be truncated');
    });
  });

  describe('failure details extraction', () => {
    it('extracts failure details (test name, message)', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'results.tap',
            errorPattern: 'not ok \\d+ - .*'
          }
        }
      };

      const resultsContent = 'not ok 1 - user authentication should work';

      const mockFs = createMockFs(resultsContent);
      const result = parseTestFailures(config, { deps: { fs: mockFs } });

      assert.equal(result.failures.length, 1, 'Should extract 1 failure');
      assert.equal(result.failures[0].test, 'user authentication should work', 'Should extract test name');
      assert.match(result.failures[0].message, /not ok 1/, 'Should have full message');
    });

    it('handles failures without standard TAP format', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'results.log',
            errorPattern: 'FAILED:.*'
          }
        }
      };

      const resultsContent = 'FAILED: Connection timeout error';

      const mockFs = createMockFs(resultsContent);
      const result = parseTestFailures(config, { deps: { fs: mockFs } });

      assert.equal(result.failures.length, 1, 'Should extract 1 failure');
      assert.equal(result.failures[0].message, 'FAILED: Connection timeout error', 'Should have raw message');
      assert.equal(result.failures[0].test, undefined, 'Should not have parsed test name');
    });
  });

  describe('truncation', () => {
    it('limits to 30 failures and sets truncated flag', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'test-results.tap',
            errorPattern: 'not ok \\d+'
          }
        }
      };

      // Generate 40 failures
      const failures = Array.from({ length: 40 }, (_, i) => `not ok ${i + 1}`);
      const resultsContent = failures.join('\n');

      const mockFs = createMockFs(resultsContent);
      const result = parseTestFailures(config, { deps: { fs: mockFs } });

      assert.equal(result.failures.length, 30, 'Should limit to 30 failures');
      assert.equal(result.totalFailures, 40, 'Should count all 40 failures');
      assert.equal(result.truncated, true, 'Should set truncated flag when > 30 failures');
    });
  });

  describe('error handling', () => {
    it('throws when results file missing', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'missing.tap',
            errorPattern: 'not ok'
          }
        }
      };

      const mockFs = createMockFs(new Error('ENOENT: no such file'));

      assert.throws(
        () => parseTestFailures(config, { deps: { fs: mockFs } }),
        /Failed to read results file/,
        'Should throw error when results file missing'
      );
    });

    it('throws when regex is invalid', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'results.tap',
            errorPattern: '[invalid(regex'
          }
        }
      };

      const mockFs = createMockFs('Some results content');

      assert.throws(
        () => parseTestFailures(config, { deps: { fs: mockFs } }),
        /Invalid regex pattern/,
        'Should throw error when regex is invalid'
      );
    });
  });

  describe('config validation', () => {
    it('throws when config is missing test.all property', () => {
      const config = {
        test: {}
      };

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseTestFailures(config, { deps: { fs: mockFs } }),
        /Config must have "test.all" property/,
        'Should throw when test.all property missing'
      );
    });

    it('throws when resultsPath is missing', () => {
      const config = {
        test: {
          all: {
            errorPattern: 'not ok'
          }
        }
      };

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseTestFailures(config, { deps: { fs: mockFs } }),
        /test.all.resultsPath is required/,
        'Should throw when resultsPath missing'
      );
    });

    it('throws when errorPattern is missing', () => {
      const config = {
        test: {
          all: {
            resultsPath: 'results.tap'
          }
        }
      };

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseTestFailures(config, { deps: { fs: mockFs } }),
        /test.all.errorPattern is required/,
        'Should throw when errorPattern missing'
      );
    });
  });
});
