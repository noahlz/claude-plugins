import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseTestFailures, FORMAT_REGISTRY } from '../../../plugins/dev-workflow/skills/run-tests/scripts/parse-test-failures.js';
import {
  createMockFs,
  parseTestsWithMock,
  parseTestsWithGlob,
  assertParserResult,
  assertFailureDetails,
  assertGlobResult
} from './helpers.js';

describe('run-tests: parse-test-failures.js', () => {
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

      const result = parseTestsWithMock(
        '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$',
        resultsContent
      );

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

      const result = parseTestsWithMock(
        '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$',
        resultsContent
      );

      assert.equal(result.mode, 'file', 'Should return file mode');
      assertParserResult(result, 0);
    });
  });

  describe('failure details extraction', () => {
    it('extracts failure details (test name, message) with named groups', () => {
      const resultsContent = 'not ok 1 - user authentication should work';

      const result = parseTestsWithMock(
        '^not ok\\s+\\d+\\s+-\\s+(?<testName>.+)$',
        resultsContent
      );

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        test: 'user authentication should work',
        message: /not ok 1/
      });
    });

    it('returns raw message when no named groups present', () => {
      const resultsContent = 'FAILED: Connection timeout error';

      const result = parseTestsWithMock('FAILED:.*', resultsContent);

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        message: 'FAILED: Connection timeout error',
        test: undefined
      });
    });

    it('extracts multiple named groups', () => {
      const resultsContent = 'com.example.AuthTest::testLogin FAILED: Expected 200 but got 401';

      const result = parseTestsWithMock(
        '(?<testClass>[\\w.]+)::(?<testName>\\w+)\\s+FAILED:\\s+(?<message>.+)',
        resultsContent
      );

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

      const result = parseTestsWithMock(
        '^not ok\\s+\\d+\\s+-\\s+(?<testName>test.+)$',
        resultsContent
      );

      assertParserResult(result, 30, { total: 40, truncated: true });
    });
  });

  describe('error handling', () => {
    it('throws when results file missing', () => {
      const mockFs = createMockFs(new Error('ENOENT: no such file'));

      assert.throws(
        () => parseTestFailures('missing.tap', 'not ok', { deps: { fs: mockFs } }),
        /Failed to read results file/,
        'Should throw error when results file missing'
      );
    });

    it('throws when regex is invalid', () => {
      const mockFs = createMockFs('Some results content');

      assert.throws(
        () => parseTestFailures('results.tap', '[invalid(regex', { deps: { fs: mockFs } }),
        /Invalid regex pattern/,
        'Should throw error when regex is invalid'
      );
    });
  });

  describe('parameter validation', () => {
    it('throws when filePath is missing', () => {
      assert.throws(
        () => parseTestFailures(null, 'not ok'),
        /filePath is required/,
        'Should throw when filePath is missing'
      );
    });

    it('throws when pattern is missing', () => {
      assert.throws(
        () => parseTestFailures('results.tap', null),
        /pattern is required/,
        'Should throw when pattern is missing'
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

      const result = parseTestsWithGlob('target/surefire-reports/TEST-*.xml', '<failure', files);

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
      const result = parseTestsWithGlob('target/surefire-reports/TEST-*.xml', '<failure', {});

      assert.equal(result.mode, 'glob', 'Should return glob mode');
      assertParserResult(result, 0);
    });

    it('returns empty array when files match but no failures found', () => {
      const files = {
        'TEST-com.example.PassingTest.xml': '<testcase>All passed</testcase>'
      };

      const result = parseTestsWithGlob('target/surefire-reports/TEST-*.xml', '<failure', files);

      assert.equal(result.mode, 'glob', 'Should return glob mode');
      assertParserResult(result, 0);
    });

    it('throws error when glob mode regex is invalid', () => {
      const files = {
        'TEST-com.example.FooTest.xml': '<testcase><failure>Error 1</failure></testcase>'
      };

      assert.throws(
        () => parseTestsWithGlob('target/surefire-reports/TEST-*.xml', '[invalid(regex', files),
        /Invalid regex pattern/,
        'Should throw error when regex is invalid in glob mode'
      );
    });

    it('truncates file list to 30 files in glob mode', () => {
      // Create 35 files with failures to test truncation
      const files = {};
      for (let i = 0; i < 35; i++) {
        files[`TEST-TestClass${i}.xml`] = '<testcase><failure>Error</failure></testcase>';
      }

      const result = parseTestsWithGlob('target/surefire-reports/TEST-*.xml', '<failure', files);

      assert.equal(result.mode, 'glob', 'Should return glob mode');
      assert.equal(result.failures.length, 30, 'Should limit to 30 files');
      assert.equal(result.truncated, true, 'Should set truncated flag');
      assert.equal(result.totalFailures, 35, 'Should count failures across all 35 files');
    });
  });

  describe('line number extraction', () => {
    it('extracts line numbers from named groups', () => {
      const resultsContent = 'test_login (test_auth.py:42) ... FAILED: AssertionError';

      const result = parseTestsWithMock(
        '(?<testName>\\w+)\\s+\\((?<file>[^:]+):(?<line>\\d+)\\).*FAILED:\\s+(?<message>.+)',
        resultsContent
      );

      assertParserResult(result, 1);
      assertFailureDetails(result.failures[0], {
        test: 'test_login',
        file: 'test_auth.py',
        line: 42,
        message: 'AssertionError'
      });
    });
  });

  describe('built-in format registry', () => {
    it('has all expected formats', () => {
      const expectedFormats = ['tap', 'junit-xml', 'pytest', 'go', 'jest', 'mocha', 'rspec', 'dotnet', 'cargo', 'generic'];
      for (const fmt of expectedFormats) {
        assert.ok(FORMAT_REGISTRY[fmt], `Should have format "${fmt}"`);
      }
    });

    const formatCases = [
      {
        format: 'tap',
        content: 'not ok 1 - should validate input',
        expectedTest: 'should validate input'
      },
      {
        format: 'pytest',
        content: 'FAILED test_auth.py::test_login - AssertionError: expected True',
        expectedTest: 'test_auth.py::test_login - AssertionError: expected True'
      },
      {
        format: 'go',
        content: '--- FAIL: TestLogin (0.00s)',
        expectedTest: 'TestLogin'
      },
      {
        format: 'jest',
        content: '  FAIL src/auth.test.js',
        expectedFile: 'src/auth.test.js'
      },
      {
        format: 'cargo',
        content: 'test auth::test_login ... FAILED',
        expectedTest: 'auth::test_login'
      }
    ];

    for (const { format, content, expectedTest, expectedFile } of formatCases) {
      it(`parses ${format} format content`, () => {
        const pattern = FORMAT_REGISTRY[format];
        const result = parseTestsWithMock(pattern, content);

        assertParserResult(result, 1);
        if (expectedTest !== undefined) {
          assertFailureDetails(result.failures[0], { test: expectedTest });
        }
        if (expectedFile !== undefined) {
          assertFailureDetails(result.failures[0], { file: expectedFile });
        }
      });
    }
  });
});
