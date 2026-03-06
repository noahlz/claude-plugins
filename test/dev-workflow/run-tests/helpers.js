import { strict as assert } from 'node:assert';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import { parseBuildErrors } from '../../../plugins/dev-workflow/skills/run-tests/scripts/parse-build-errors.js';
import { parseTestFailures } from '../../../plugins/dev-workflow/skills/run-tests/scripts/parse-test-failures.js';

// Re-export generic helpers for convenience
export { setupTestEnv, teardownTestEnv };

/**
 * Create mock fs module for testing
 * @param {string|Error} content - Content to return from readFileSync, or Error to throw
 * @returns {Object} Mock fs module
 */
export function createMockFs(content) {
  return {
    readFileSync: () => {
      if (content instanceof Error) {
        throw content;
      }
      return content;
    }
  };
}

/**
 * Create mock dependencies for glob mode testing
 * @param {Object<string, string>} files - Map of filename to content
 * @returns {Object} Mock deps object { fs, path, globSync }
 */
export function createMockGlobDeps(files) {
  const filenames = Object.keys(files);

  return {
    fs: {
      readFileSync: (path) => {
        // Extract filename from path
        const filename = path.split('/').pop();
        if (files[filename] !== undefined) {
          return files[filename];
        }
        throw new Error(`ENOENT: no such file: ${path}`);
      }
    },
    path: {
      basename: (path) => path.split('/').pop()
    },
    globSync: (pattern) => {
      // Extract directory and filename pattern from full path
      const parts = pattern.split('/');
      const filenamePattern = parts[parts.length - 1];
      const dirPath = parts.slice(0, -1).join('/');

      // Convert glob pattern to regex
      const regexPattern = filenamePattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);

      // Return full paths for matching filenames
      return filenames
        .filter(name => regex.test(name))
        .map(name => `${dirPath}/${name}`);
    }
  };
}

// ============================================================================
// Parser Test Helpers
// ============================================================================

/**
 * Assert on parser result structure (count, total, truncated)
 * @param {Object} result - Parser result object
 * @param {number} expectedCount - Expected count of errors/failures
 * @param {Object} options - Optional overrides { total, truncated }
 */
export function assertParserResult(result, expectedCount, options = {}) {
  const { total = expectedCount, truncated = false } = options;

  const actualCount = result.errors?.length ?? result.failures?.length ?? 0;
  assert.equal(
    actualCount,
    expectedCount,
    `Should extract ${expectedCount} item(s)`
  );

  const actualTotal = result.totalErrors ?? result.totalFailures ?? 0;
  assert.equal(
    actualTotal,
    total,
    `Should count ${total} total item(s)`
  );

  assert.equal(result.truncated, truncated, `Should ${truncated ? '' : 'not '}be truncated`);
}

/**
 * Assert on build error details
 * @param {Object} error - Error object from parseBuildErrors
 * @param {Object} expected - Expected values { file, line, column, message }
 */
export function assertErrorDetails(error, expected) {
  const { file, line, column, message } = expected;

  if (file !== undefined) {
    assert.equal(error.file, file, `Should have file "${file}"`);
  }
  if (line !== undefined) {
    assert.equal(error.line, line, `Should have line ${line}`);
  }
  if (column !== undefined) {
    assert.equal(error.column, column, `Should have column ${column}`);
  }
  if (message !== undefined) {
    if (message instanceof RegExp) {
      assert.match(error.message, message, `Should match message pattern`);
    } else {
      assert.equal(error.message, message, `Should have message "${message}"`);
    }
  }
}

/**
 * Assert on test failure details
 * @param {Object} failure - Failure object from parseTestFailures
 * @param {Object} expected - Expected values { test, testClass, message, file, count }
 */
export function assertFailureDetails(failure, expected) {
  const { test, testClass, message, file, count } = expected;

  if (test !== undefined) {
    assert.equal(failure.test, test, `Should have test name "${test}"`);
  }
  if (testClass !== undefined) {
    assert.equal(failure.testClass, testClass, `Should have test class "${testClass}"`);
  }
  if (message !== undefined) {
    if (message instanceof RegExp) {
      assert.match(failure.message, message, 'Should match message pattern');
    } else {
      assert.equal(failure.message, message, `Should have message "${message}"`);
    }
  }
  if (file !== undefined) {
    assert.equal(failure.file, file, `Should have file "${file}"`);
  }
  if (count !== undefined) {
    assert.equal(failure.count, count, `Should have count ${count}`);
  }
}

/**
 * Assert on glob mode result
 * @param {Object} result - parseTestFailures result
 * @param {number} expectedFileCount - Expected number of files with failures
 * @param {number} expectedTotalFailures - Expected total failure count
 */
export function assertGlobResult(result, expectedFileCount, expectedTotalFailures) {
  assert.equal(result.mode, 'glob', 'Should return glob mode');
  assert.equal(result.failures.length, expectedFileCount, `Should have ${expectedFileCount} file(s) with failures`);
  assert.equal(result.totalFailures, expectedTotalFailures, `Should count ${expectedTotalFailures} total failures`);
  assert.equal(result.truncated, false, 'Should not be truncated');
}

/**
 * Run parseBuildErrors with mock fs
 * @param {string} pattern - Error pattern
 * @param {string} logContent - Log file content
 * @returns {Object} Parser result
 */
export function parseBuildWithMock(pattern, logContent) {
  const mockFs = createMockFs(logContent);
  return parseBuildErrors('build.log', pattern, { deps: { fs: mockFs } });
}

/**
 * Run parseTestFailures with mock fs
 * @param {string} pattern - Error pattern
 * @param {string} resultsContent - Results file content
 * @returns {Object} Parser result
 */
export function parseTestsWithMock(pattern, resultsContent) {
  const mockFs = createMockFs(resultsContent);
  return parseTestFailures('results.tap', pattern, { deps: { fs: mockFs } });
}

/**
 * Run parseTestFailures in glob mode with mock dependencies
 * @param {string} filePath - Glob pattern path
 * @param {string} pattern - Error pattern
 * @param {Object<string, string>} files - Map of filename to content
 * @returns {Object} Parser result
 */
export function parseTestsWithGlob(filePath, pattern, files) {
  const mockDeps = createMockGlobDeps(files);
  return parseTestFailures(filePath, pattern, { deps: mockDeps });
}
