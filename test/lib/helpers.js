import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { strict as assert } from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename), '..'); // test/
const TESTS_ROOT = __dirname; // test/
const PLUGIN_ROOT = join(dirname(TESTS_ROOT), 'plugins'); // project root plugins directory

/**
 * Setup test environment
 * @returns {Object} Test environment object with cleanup function
 */
export function setupTestEnv() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'node-test-'));

  // Create .claude directory
  mkdirSync(join(tmpDir, '.claude'), { recursive: true });

  // Create mocks directory in tmpDir
  const mockPath = join(tmpDir, 'mocks');
  mkdirSync(mockPath, { recursive: true });

  const env = {
    tmpDir,
    pluginRoot: PLUGIN_ROOT,
    mockPath: mockPath,
    cleanup: () => {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  return env;
}

/**
 * Teardown test environment
 * @param {Object} env - Test environment object from setupTestEnv
 */
export function teardownTestEnv(env) {
  if (env && env.cleanup) {
    try {
      env.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Assert two JSON objects are equal (order-independent)
 * @param {string|Object} expected - Expected JSON
 * @param {string|Object} actual - Actual JSON
 * @param {string} message - Optional assertion message
 */
export function assertJsonEquals(expected, actual, message = 'JSON objects not equal') {
  let expectedObj = typeof expected === 'string' ? JSON.parse(expected) : expected;
  let actualObj = typeof actual === 'string' ? JSON.parse(actual) : actual;

  assert.deepStrictEqual(actualObj, expectedObj, message);
}

/**
 * Assert that a JSON object contains a specific key
 * @param {string|Object} json - JSON data
 * @param {string} key - Key to check for
 * @param {string} message - Optional assertion message
 */
export function assertJsonHasKey(json, key, message = `JSON missing key: ${key}`) {
  let obj = typeof json === 'string' ? JSON.parse(json) : json;
  assert.ok(key in obj, message);
}

/**
 * Assert string matches regex pattern
 * @param {string} str - String to test
 * @param {string|RegExp} pattern - Pattern to match
 * @param {string} message - Optional assertion message
 */
export function assertMatches(str, pattern, message = 'String does not match pattern') {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  assert.match(str, regex, message);
}

/**
 * Assert file exists
 * @param {string} filePath - Path to file
 * @param {string} message - Optional assertion message
 */
export function assertFileExists(filePath, message = `File not found: ${filePath}`) {
  try {
    readFileSync(filePath);
  } catch (e) {
    throw new assert.AssertionError({ message });
  }
}

/**
 * Assert file does not exist
 * @param {string} filePath - Path to file
 * @param {string} message - Optional assertion message
 */
export function assertFileNotExists(filePath, message = `File should not exist: ${filePath}`) {
  try {
    readFileSync(filePath);
    throw new assert.AssertionError({ message });
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e;
    // Expected - file doesn't exist
  }
}

/**
 * Create a fixture file
 * @param {string} fixtureName - Name/path of fixture
 * @param {string} content - Content to write
 * @param {string} outputPath - Optional output path (defaults to test tmpdir fixture)
 * @returns {string} Path to created fixture
 */
export function createFixture(fixtureName, content, outputPath) {
  const filePath = outputPath || join(process.cwd(), fixtureName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

/**
 * Read fixture file
 * @param {string} fixtureName - Name of fixture file in tests/fixtures/
 * @returns {string} File contents
 */
export function readFixture(pluginName, fixtureName) {
  const fixturePath = join(TESTS_ROOT, pluginName, 'fixtures', fixtureName);
  return readFileSync(fixturePath, 'utf8');
}

/**
 * Execute bash script and capture output/exit code
 * @param {string} pluginName - Plugin name
 * @param {string} scriptPath - Path to bash script
 * @param {Object} options - Options object
 * @param {string} options.cwd - Working directory
 * @param {Object} options.env - Environment variables (merged with process.env)
 * @param {string} options.input - stdin input
 * @param {string[]} options.args - Arguments to pass to script
 * @returns {Object} { exitCode, stdout, stderr }
 */
export function execBashScript(pluginName, scriptPath, options = {}) {
  const {
    cwd = process.cwd(),
    env = {},
    input = '',
    args = []
  } = options;

  const fullEnv = {
    ...process.env,
    ...env,
    PATH: `${join(TESTS_ROOT, pluginName, 'lib', 'mocks')}:${process.env.PATH}`
  };

  try {
    const result = spawnSync('bash', [scriptPath, ...args], {
      cwd,
      env: fullEnv,
      input,
      encoding: 'utf8'
    });

    return {
      exitCode: result.status || 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      output: result.stdout || ''
    };
  } catch (e) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: e.message,
      error: e
    };
  }
}

/**
 * Get the path to a plugin script
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @param {string} skillName - Skill name (e.g., 'write-git-commit')
 * @param {string} scriptName - Script name (e.g., 'load-config.sh')
 * @returns {string} Full path to script
 */
export function getPluginScriptPath(pluginName, skillName, scriptName) {
  return join(PLUGIN_ROOT, 'plugins', pluginName, 'skills', skillName, 'scripts', scriptName);
}

export { TESTS_ROOT, PLUGIN_ROOT };
