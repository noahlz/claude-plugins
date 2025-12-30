import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
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
 * Execute a Node.js script with given options
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @param {string} scriptPath - Path to Node.js script
 * @param {object} options - Options { cwd, env, input, args }
 * @returns {object} Result object { exitCode, stdout, stderr, output }
 */
export function execNodeScript(pluginName, scriptPath, options = {}) {
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
    const result = spawnSync('node', [scriptPath, ...args], {
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
 * @param {string} scriptName - Script name (e.g., 'load-config.sh' or 'load-config.js')
 * @returns {string} Full path to script
 */
export function getPluginScriptPath(pluginName, skillName, scriptName) {
  return join(PLUGIN_ROOT, pluginName, 'skills', skillName, 'scripts', scriptName);
}

/**
 * Extract JSON from output that may have npm audit or other non-JSON text before it
 * @param {string} output - Output string that may contain JSON
 * @returns {Object|null} Parsed JSON object or null if no JSON found
 */
export function extractJsonFromOutput(output) {
  // Find the first { character which marks the start of JSON
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    return null;
  }

  // Try to parse from that point onward
  const jsonPart = output.substring(jsonStart);
  try {
    return JSON.parse(jsonPart);
  } catch (e) {
    return null;
  }
}

/**
 * Get specific plugin root directory
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @returns {string} - Path to plugin root
 */
export function getPluginRoot(pluginName) {
  return join(PLUGIN_ROOT, pluginName);
}

/**
 * Setup test environment with plugin-specific paths
 * @param {string} pluginName - Plugin name (e.g., 'dev-workflow')
 * @returns {Object} Test environment with pluginRoot and tmpDir
 */
export function setupPluginTestEnv(pluginName) {
  const env = setupTestEnv();
  return {
    ...env,
    pluginRoot: getPluginRoot(pluginName)
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

/**
 * Read and parse a JSON file
 * @param {string} filePath - Absolute path to JSON file
 * @returns {Object} Parsed JSON object
 */
export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Assert that a config object has the required run-and-fix-tests structure
 * @param {Object} config - Config object to validate
 * @param {string} message - Optional assertion message
 */
export function assertValidRunAndFixTestsConfig(config, message = 'Invalid config structure') {
  assert.ok(config.build !== undefined || config.skipBuild === true, `${message}: missing build`);
  assert.ok(config.test, `${message}: missing test`);
  assert.ok(config.test.all, `${message}: missing test.all`);

  if (Array.isArray(config.build)) {
    config.build.forEach((build, idx) => {
      assert.ok(build.command, `${message}: build[${idx}] missing command`);
      assert.ok(build.logFile, `${message}: build[${idx}] missing logFile`);
      assert.ok(build.errorPattern, `${message}: build[${idx}] missing errorPattern`);
    });
  }
}

export { TESTS_ROOT, PLUGIN_ROOT };
