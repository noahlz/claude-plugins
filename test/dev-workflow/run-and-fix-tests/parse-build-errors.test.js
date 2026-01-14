import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBuildErrors } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-build-errors.js';
import {
  createMockFs,
  parseBuildWithMock,
  assertParserResult,
  assertErrorDetails
} from './helpers.js';

describe('run-and-fix-tests: parse-build-errors.js', () => {
  describe('parsing', () => {
    it('parses build log and extracts errors', () => {
      const logContent = `
Building project...
src/app.ts:42:5: error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts:10:12: error TS2304: Cannot find name 'foo'.
Build completed with errors.
`;

      const result = parseBuildWithMock({
        errorPattern: 'src/.*\\.ts:\\d+:\\d+: error TS\\d+:.*'
      }, logContent);

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

      const result = parseBuildWithMock({
        errorPattern: 'error TS\\d+:'
      }, logContent);

      assertParserResult(result, 0);
    });
  });

  describe('error details extraction', () => {
    it('includes error details (file, line, message)', () => {
      const logContent = 'src/test.ts:100:20: Syntax error here';

      const result = parseBuildWithMock({
        errorPattern: '.*\\.ts:\\d+:\\d+:.*'
      }, logContent);

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

      const result = parseBuildWithMock({
        errorPattern: 'FATAL ERROR:.*'
      }, logContent);

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

      const result = parseBuildWithMock({
        errorPattern: 'ERROR:'
      }, logContent);

      assertParserResult(result, 30, { total: 50, truncated: true });
    });
  });

  describe('error handling', () => {
    it('throws when log file missing', () => {
      const config = {
        build: {
          logFile: 'missing.log',
          errorPattern: 'error'
        }
      };

      const mockFs = createMockFs(new Error('ENOENT: no such file'));

      assert.throws(
        () => parseBuildErrors(config, { deps: { fs: mockFs } }),
        /Failed to read log file/,
        'Should throw error when log file missing'
      );
    });

    it('throws when regex is invalid', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: '[invalid(regex'
        }
      };

      const mockFs = createMockFs('Some log content');

      assert.throws(
        () => parseBuildErrors(config, { deps: { fs: mockFs } }),
        /Invalid regex pattern/,
        'Should throw error when regex is invalid'
      );
    });
  });

  describe('config validation', () => {
    it('throws when config is missing build property', () => {
      const config = {};

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseBuildErrors(config, { deps: { fs: mockFs } }),
        /Config must have "build" property/,
        'Should throw when build property missing'
      );
    });

    it('throws when logFile is missing', () => {
      const config = {
        build: {
          errorPattern: 'error'
        }
      };

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseBuildErrors(config, { deps: { fs: mockFs } }),
        /build.logFile is required/,
        'Should throw when logFile missing'
      );
    });

    it('throws when errorPattern is missing', () => {
      const config = {
        build: {
          logFile: 'build.log'
        }
      };

      const mockFs = createMockFs('content');

      assert.throws(
        () => parseBuildErrors(config, { deps: { fs: mockFs } }),
        /build.errorPattern is required/,
        'Should throw when errorPattern missing'
      );
    });
  });
});
