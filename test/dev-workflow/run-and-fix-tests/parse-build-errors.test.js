import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBuildErrors } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-build-errors.js';
import { createMockFs } from './helpers.js';

describe('run-and-fix-tests: parse-build-errors.js', () => {
  describe('parsing', () => {
    it('parses build log and extracts errors', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: 'src/.*\\.ts:\\d+:\\d+: error TS\\d+:.*'
        }
      };

      const logContent = `
Building project...
src/app.ts:42:5: error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts:10:12: error TS2304: Cannot find name 'foo'.
Build completed with errors.
`;

      const mockFs = createMockFs(logContent);
      const result = parseBuildErrors(config, { deps: { fs: mockFs } });

      assert.equal(result.errors.length, 2, 'Should extract 2 errors');
      assert.equal(result.totalErrors, 2, 'Should count 2 total errors');
      assert.equal(result.truncated, false, 'Should not be truncated');

      assert.equal(result.errors[0].file, 'src/app.ts', 'Should extract file path');
      assert.equal(result.errors[0].line, 42, 'Should extract line number');
      assert.equal(result.errors[0].column, 5, 'Should extract column number');
      assert.match(result.errors[0].message, /Type 'string'/, 'Should extract error message');
    });

    it('returns empty array when no errors found', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: 'error TS\\d+:'
        }
      };

      const logContent = 'Build completed successfully.\nNo errors found.';

      const mockFs = createMockFs(logContent);
      const result = parseBuildErrors(config, { deps: { fs: mockFs } });

      assert.equal(result.errors.length, 0, 'Should return empty array');
      assert.equal(result.totalErrors, 0, 'Should count 0 total errors');
      assert.equal(result.truncated, false, 'Should not be truncated');
    });
  });

  describe('error details extraction', () => {
    it('includes error details (file, line, message)', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: '.*\\.ts:\\d+:\\d+:.*'
        }
      };

      const logContent = 'src/test.ts:100:20: Syntax error here';

      const mockFs = createMockFs(logContent);
      const result = parseBuildErrors(config, { deps: { fs: mockFs } });

      assert.equal(result.errors.length, 1, 'Should extract 1 error');
      assert.equal(result.errors[0].file, 'src/test.ts', 'Should have file');
      assert.equal(result.errors[0].line, 100, 'Should have line');
      assert.equal(result.errors[0].column, 20, 'Should have column');
      assert.match(result.errors[0].message, /Syntax error/, 'Should have message');
    });

    it('handles errors without file/line info', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: 'FATAL ERROR:.*'
        }
      };

      const logContent = 'FATAL ERROR: Out of memory';

      const mockFs = createMockFs(logContent);
      const result = parseBuildErrors(config, { deps: { fs: mockFs } });

      assert.equal(result.errors.length, 1, 'Should extract 1 error');
      assert.equal(result.errors[0].message, 'FATAL ERROR: Out of memory', 'Should have raw message');
      assert.equal(result.errors[0].file, undefined, 'Should not have file');
      assert.equal(result.errors[0].line, undefined, 'Should not have line');
    });
  });

  describe('truncation', () => {
    it('limits to 30 errors and sets truncated flag', () => {
      const config = {
        build: {
          logFile: 'build.log',
          errorPattern: 'ERROR:'
        }
      };

      // Generate 50 errors
      const errors = Array.from({ length: 50 }, (_, i) => `ERROR: Error ${i + 1}`);
      const logContent = errors.join('\n');

      const mockFs = createMockFs(logContent);
      const result = parseBuildErrors(config, { deps: { fs: mockFs } });

      assert.equal(result.errors.length, 30, 'Should limit to 30 errors');
      assert.equal(result.totalErrors, 50, 'Should count all 50 errors');
      assert.equal(result.truncated, true, 'Should set truncated flag when > 30 errors');
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
