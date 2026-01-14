import { writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { setupTestEnv, teardownTestEnv, readFixture } from '../../lib/helpers.js';
import { parseBuildErrors } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-build-errors.js';
import { parseTestFailures } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/parse-test-failures.js';
import { loadConfig } from '../../../plugins/dev-workflow/skills/run-and-fix-tests/scripts/load-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename), '../..');  // test/
const TESTS_ROOT = __dirname;
const PLUGIN_ROOT = join(dirname(TESTS_ROOT), 'plugins');

// Re-export generic helpers for convenience
export { setupTestEnv, teardownTestEnv, readFixture };

/**
 * Setup test environment with plugin-specific paths
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @returns {Object} Test environment with pluginRoot and tmpDir
 */
export function setupPluginTestEnv(pluginName) {
  const env = setupTestEnv();
  return {
    ...env,
    pluginRoot: join(PLUGIN_ROOT, pluginName)
  };
}

/**
 * Load a config fixture and write to test environment
 * @param {Object} testEnv - Test environment from setupTestEnv
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @param {string} fixtureName - Fixture name (e.g., 'configs/single-build-npm.json')
 * @param {Function} modifyFn - Optional function to modify config before writing
 * @returns {Object} The loaded (and possibly modified) config object
 */
export function loadConfigFixture(testEnv, pluginName, fixtureName, modifyFn) {
  const fixtureData = readFixture(pluginName, fixtureName);
  let config = JSON.parse(fixtureData);

  if (modifyFn) {
    config = modifyFn(config);
  }

  const configDir = join(testEnv.tmpDir, '.claude');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'settings.plugins.run-and-fix-tests.json'),
    JSON.stringify(config)
  );

  return config;
}

/**
 * Copy a project template to the test environment
 * @param {Object} testEnv - Test environment from setupTestEnv
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @param {string} templateName - Template directory name
 */
export function setupProjectTemplate(testEnv, pluginName, templateName) {
  const templatePath = join(TESTS_ROOT, pluginName, 'fixtures', 'project-templates', templateName);
  cpSync(templatePath, testEnv.tmpDir, { recursive: true });
}

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

/**
 * Create a tool config object for testing
 * @param {string} toolName - Tool name (e.g., 'npm', 'maven', 'go')
 * @param {Object} overrides - Optional overrides for config properties
 * @returns {Object} Tool config object
 */
export function createToolConfig(toolName, overrides = {}) {
  const defaultConfigs = {
    npm: {
      tool: 'npm',
      location: '(project root)',
      configFile: 'package.json'
    },
    maven: {
      tool: 'maven',
      location: '(project root)',
      configFile: 'pom.xml'
    },
    gradle: {
      tool: 'gradle',
      location: '(project root)',
      configFile: 'build.gradle'
    },
    go: {
      tool: 'go',
      location: '(project root)',
      configFile: 'go.mod'
    }
  };

  const baseConfig = defaultConfigs[toolName] || {
    tool: toolName,
    location: '(project root)',
    configFile: `${toolName}.config`
  };

  // Load fixture config for npm and maven
  let config = null;
  if (toolName === 'npm' || toolName === 'maven') {
    try {
      const fixtureData = readFixture('dev-workflow', 'configs/single-build-npm.json');
      config = JSON.parse(fixtureData);
    } catch (e) {
      config = {};
    }
  }

  return {
    ...baseConfig,
    config,
    ...overrides
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
 * Run parseBuildErrors with standard pattern: config + mock fs + parse
 * @param {Object} configOverrides - Config overrides for build property
 * @param {string} logContent - Log file content
 * @returns {Object} Parser result
 */
export function parseBuildWithMock(configOverrides, logContent) {
  const config = {
    build: {
      logFile: 'build.log',
      errorPattern: 'error',
      ...configOverrides
    }
  };

  const mockFs = createMockFs(logContent);
  return parseBuildErrors(config, { deps: { fs: mockFs } });
}

/**
 * Run parseTestFailures with standard pattern: config + mock fs + parse
 * @param {Object} configOverrides - Config overrides for test.all property
 * @param {string} resultsContent - Results file content
 * @returns {Object} Parser result
 */
export function parseTestsWithMock(configOverrides, resultsContent) {
  const config = {
    test: {
      all: {
        resultsPath: 'results.tap',
        errorPattern: '^not ok',
        ...configOverrides
      }
    }
  };

  const mockFs = createMockFs(resultsContent);
  return parseTestFailures(config, { deps: { fs: mockFs } });
}

/**
 * Run parseTestFailures in glob mode
 * @param {Object} configOverrides - Config overrides for test.all property
 * @param {Object<string, string>} files - Map of filename to content
 * @returns {Object} Parser result
 */
export function parseTestsWithGlob(configOverrides, files) {
  const config = {
    test: {
      all: {
        resultsPath: 'target/surefire-reports/TEST-*.xml',
        errorPattern: '<failure',
        ...configOverrides
      }
    }
  };

  const mockDeps = createMockGlobDeps(files);
  return parseTestFailures(config, { deps: mockDeps });
}

// ============================================================================
// Config Test Helpers
// ============================================================================

/**
 * Load config fixture and assert on result
 * @param {Object} testEnv - Test environment
 * @param {string} fixtureName - Fixture name
 * @param {Function} modifyFn - Optional config modifier
 * @param {Function} assertFn - Custom assertion function
 * @returns {Object} loadConfig result
 */
export function loadAndAssertConfig(testEnv, fixtureName, modifyFn, assertFn) {
  loadConfigFixture(testEnv, 'dev-workflow', fixtureName, modifyFn);
  const result = loadConfig({ baseDir: testEnv.tmpDir });

  if (assertFn) {
    assertFn(result);
  }

  return result;
}

/**
 * Assert config loaded without errors
 * @param {Object} result - loadConfig result
 * @param {string} message - Optional custom message
 */
export function assertNoConfigErrors(result, message = 'Should have no errors') {
  assert.equal(result.errors.length, 0, message);
  assert.ok(result.resolved, 'Should have resolved config');
}

/**
 * Assert config has validation errors
 * @param {Object} result - loadConfig result
 * @param {RegExp} errorPattern - Pattern to match in error message
 */
export function assertConfigError(result, errorPattern) {
  assert.ok(result.errors.length > 0, 'Should have validation errors');
  assert.match(result.errors[0], errorPattern, 'Error should match expected pattern');
}
