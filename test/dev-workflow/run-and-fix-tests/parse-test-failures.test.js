import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseTestFailures } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-test-failures.js';
import {
  createMockFs,
  parseTestsWithMock,
  parseTestsWithGlob,
  assertParserResult,
  assertFailureDetails,
  assertGlobResult
} from './helpers.js';

describe('run-and-fix-tests: parse-test-failures.js', () => {
  describe('parsing', () => {
    it('parses test results and counts failures', () => {
      const resultsContent = `
TAP version 13
1..5
ok 1 - test passes
not ok 2 - should validate input
not ok 3 - should handle errors correctly
ok 4 - another passing test
not ok 5 - final failing test
`;

      const result = parseTestsWithMock({
        resultsPath: 'test-results.tap',
        errorPattern: '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$'
      }, resultsContent);

      assert.equal(result.mode, 'file', 'Should return file mode');
      assertParserResult(result, 3);
      assertFailureDetails(result.failures[0], {
        test: 'should validate input',
        message: /not ok 2/
      });
    });

    it('returns zero count when all tests pass', () => {
      const resultsContent = `
TAP version 13
1..3
ok 1 - test one
ok 2 - test two
ok 3 - test three
`;

      const result = parseTestsWithMock({
        errorPattern: '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$'
      }, resultsContent);

      assert.equal(result.mode, 'file', 'Should return file mode');
      assertParserResult(result, 0);
    });
  });

  describe('failure details extraction', () => {
    it('extracts failure details (test name, message) with named groups', () => {
      const resultsContent = 'not ok 1 - user authentication should work';

      const result = parseTestsWithMock({
        errorPattern: '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$'
      }, resultsContent);

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        test: 'user authentication should work',
        message: /not ok 1/
      });
    });

    it('returns raw message when no named groups present', () => {
      const resultsContent = 'FAILED: Connection timeout error';

      const result = parseTestsWithMock({
        errorPattern: 'FAILED:.*'
      }, resultsContent);

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        message: 'FAILED: Connection timeout error',
        test: undefined
      });
    });

    it('extracts multiple named groups', () => {
      const resultsContent = 'com.example.AuthTest::testLogin FAILED: Expected 200 but got 401';

      const result = parseTestsWithMock({
        errorPattern: '(?<testClass>[\\w.]+)::(?<testName>\\w+)\\s+FAILED:\\s+(?<message>.+)'
      }, resultsContent);

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        testClass: 'com.example.AuthTest',
        test: 'testLogin',
        message: 'Expected 200 but got 401'
      });
    });
  });

  describe('truncation', () => {
    it('limits to 30 failures and sets truncated flag', () => {
      // Generate 40 failures
      const failures = Array.from({ length: 40 }, (_, i) => `not ok ${i + 1} - test${i + 1}`);
      const resultsContent = failures.join('\n');

      const result = parseTestsWithMock({
        errorPattern: '^not ok\\s+\\d+\\s+-\\s+(?<testName>test.+)$'
      }, resultsContent);

      assertParserResult(result, 30, { total: 40, truncated: true });
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

  describe('glob mode', () => {
    it('detects glob pattern and returns filenames with failure counts', () => {
      const files = {
        'TEST-com.example.FooTest.xml': '<testcase><failure>Error 1</failure></testcase><testcase><failure>Error 2</failure></testcase>',
        'TEST-com.example.BarTest.xml': '<testcase><failure>Error 3</failure></testcase>',
        'TEST-com.example.PassingTest.xml': '<testcase>All passed</testcase>'
      };

      const result = parseTestsWithGlob({
        resultsPath: 'target/surefire-reports/TEST-*.xml',
        errorPattern: '<failure'
      }, files);

      assertGlobResult(result, 2, 3);
      assertFailureDetails(result.failures[0], {
        file: 'TEST-com.example.FooTest.xml',
        count: 2
      });
      assertFailureDetails(result.failures[1], {
        file: 'TEST-com.example.BarTest.xml',
        count: 1
      });
    });

    it('returns empty array when no files match glob', () => {
      const result = parseTestsWithGlob({
        resultsPath: 'target/surefire-reports/TEST-*.xml',
        errorPattern: '<failure'
      }, {});

      assert.equal(result.mode, 'glob', 'Should return glob mode');
      assertParserResult(result, 0);
    });

    it('returns empty array when files match but no failures found', () => {
      const files = {
        'TEST-com.example.PassingTest.xml': '<testcase>All passed</testcase>'
      };

      const result = parseTestsWithGlob({
        resultsPath: 'target/surefire-reports/TEST-*.xml',
        errorPattern: '<failure'
      }, files);

      assert.equal(result.mode, 'glob', 'Should return glob mode');
      assertParserResult(result, 0);
    });
  });
});
