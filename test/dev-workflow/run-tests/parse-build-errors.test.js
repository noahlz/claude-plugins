import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBuildErrors, FORMAT_REGISTRY } from '../../../plugins/dev-workflow/skills/run-tests/scripts/parse-build-errors.js';
import {
  createMockFs,
  parseBuildWithMock,
  assertParserResult,
  assertErrorDetails
} from './helpers.js';

describe('run-tests: parse-build-errors.js', () => {
  describe('parsing', () => {
    it('parses build log and extracts errors', () => {
      const logContent = `
Building project...
src/app.ts:42:5: error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts:10:12: error TS2304: Cannot find name 'foo'.
Build completed with errors.
`;

      const result = parseBuildWithMock(
        'src/.*\\.ts:\\d+:\\d+: error TS\\d+:.*',
        logContent
      );

      assertParserResult(result, 2);
      assertErrorDetails(result.errors[0], {
        file: 'src/app.ts',
        line: 42,
        column: 5,
        message: /Type 'string'/
      });
    });

    it('returns empty array when no errors found', () => {
      const logContent = 'Build completed successfully.\nNo errors found.';

      const result = parseBuildWithMock('error TS\\d+:', logContent);

      assertParserResult(result, 0);
    });
  });

  describe('error details extraction', () => {
    it('includes error details (file, line, message)', () => {
      const logContent = 'src/test.ts:100:20: Syntax error here';

      const result = parseBuildWithMock('.*\\.ts:\\d+:\\d+:.*', logContent);

      assertParserResult(result, 1);
      assertErrorDetails(result.errors[0], {
        file: 'src/test.ts',
        line: 100,
        column: 20,
        message: /Syntax error/
      });
    });

    it('handles errors without file/line info', () => {
      const logContent = 'FATAL ERROR: Out of memory';

      const result = parseBuildWithMock('FATAL ERROR:.*', logContent);

      assertParserResult(result, 1);
      assertErrorDetails(result.errors[0], {
        message: 'FATAL ERROR: Out of memory',
        file: undefined,
        line: undefined
      });
    });
  });

  describe('truncation', () => {
    it('limits to 30 errors and sets truncated flag', () => {
      // Generate 50 errors
      const errors = Array.from({ length: 50 }, (_, i) => `ERROR: Error ${i + 1}`);
      const logContent = errors.join('\n');

      const result = parseBuildWithMock('ERROR:', logContent);

      assertParserResult(result, 30, { total: 50, truncated: true });
    });
  });

  describe('error handling', () => {
    it('throws when log file missing', () => {
      const mockFs = createMockFs(new Error('ENOENT: no such file'));

      assert.throws(
        () => parseBuildErrors('missing.log', 'error', { deps: { fs: mockFs } }),
        /Failed to read log file/,
        'Should throw error when log file missing'
      );
    });

    it('throws when regex is invalid', () => {
      const mockFs = createMockFs('Some log content');

      assert.throws(
        () => parseBuildErrors('build.log', '[invalid(regex', { deps: { fs: mockFs } }),
        /Invalid regex pattern/,
        'Should throw error when regex is invalid'
      );
    });
  });

  describe('parameter validation', () => {
    it('throws when filePath is missing', () => {
      assert.throws(
        () => parseBuildErrors(null, 'error'),
        /filePath is required/,
        'Should throw when filePath is missing'
      );
    });

    it('throws when pattern is missing', () => {
      assert.throws(
        () => parseBuildErrors('build.log', null),
        /pattern is required/,
        'Should throw when pattern is missing'
      );
    });
  });

  describe('built-in format registry', () => {
    it('has all expected formats', () => {
      const expectedFormats = ['maven', 'gradle', 'tsc', 'gcc', 'cargo', 'go', 'generic'];
      for (const fmt of expectedFormats) {
        assert.ok(FORMAT_REGISTRY[fmt], `Should have format "${fmt}"`);
      }
    });

    it('parses maven format errors', () => {
      const logContent = '[ERROR] src/main/java/App.java:[42,5] cannot find symbol';
      const result = parseBuildWithMock(FORMAT_REGISTRY.maven, logContent);
      assertParserResult(result, 1);
    });

    it('parses tsc format errors with named groups', () => {
      const logContent = 'src/app.ts(42,5): error TS2322: Type string is not assignable to number';
      const result = parseBuildWithMock(FORMAT_REGISTRY.tsc, logContent);
      assertParserResult(result, 1);
      assertErrorDetails(result.errors[0], {
        file: 'src/app.ts',
        line: 42,
        column: 5,
        message: /Type string/
      });
    });

    it('parses gcc format errors with named groups', () => {
      const logContent = 'src/main.c:42:5: error: undefined reference to foo';
      const result = parseBuildWithMock(FORMAT_REGISTRY.gcc, logContent);
      assertParserResult(result, 1);
      assertErrorDetails(result.errors[0], {
        file: 'src/main.c',
        line: 42,
        column: 5,
        message: /undefined reference/
      });
    });

    it('parses cargo format errors', () => {
      const logContent = 'error[E0308]: mismatched types';
      const result = parseBuildWithMock(FORMAT_REGISTRY.cargo, logContent);
      assertParserResult(result, 1);
    });

    it('parses go format errors with named groups', () => {
      const logContent = 'src/main.go:42:5: undefined: foo';
      const result = parseBuildWithMock(FORMAT_REGISTRY.go, logContent);
      assertParserResult(result, 1);
      assertErrorDetails(result.errors[0], {
        file: 'src/main.go',
        line: 42,
        message: /undefined/
      });
    });
  });
});
