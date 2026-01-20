import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename), '..'); // test/
const TESTS_ROOT = __dirname; // test/
const PLUGIN_ROOT = join(dirname(TESTS_ROOT), 'plugins'); // project root plugins directory

/**
 * Generic command executor
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Object} options - Options object
 * @param {string} options.cwd - Working directory
 * @param {string} options.input - stdin input
 * @returns {Object} { exitCode, stdout, stderr, output }
 */
function execCommand(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    input = ''
  } = options;

  try {
    const result = spawnSync(command, args, {
      cwd,
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
 * Setup test environment
 * @returns {Object} Test environment object
 */
export function setupTestEnv() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'node-test-'));

  // Create .claude directory
  mkdirSync(join(tmpDir, '.claude'), { recursive: true });

  const testEnv = {
    tmpDir,
    pluginRoot: PLUGIN_ROOT,
    cleanup: () => {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  return testEnv;
}

/**
 * Teardown test environment
 * @param {Object} testEnv - Test environment object from setupTestEnv
 */
export function teardownTestEnv(testEnv) {
  if (testEnv && testEnv.cleanup) {
    try {
      testEnv.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
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
 * Execute a Node.js script with given options
 * @param {string} scriptPath - Path to Node.js script
 * @param {object} options - Options { cwd, env, input, args }
 * @returns {object} Result object { exitCode, stdout, stderr, output }
 */
export function execNodeScript(scriptPath, options = {}) {
  const {
    cwd = process.cwd(),
    input = '',
    args = []
  } = options;

  return execCommand('node', [scriptPath, ...args], { cwd, input });
}

/**
 * Execute a git command and capture output/exit code
 * @param {string[]} args - Git command arguments (e.g., ['init'] or ['config', 'user.email', 'test@example.com'])
 * @param {Object} options - Options object
 * @param {string} options.cwd - Working directory
 * @returns {Object} { exitCode, stdout, stderr, output }
 */
export function execGit(args, options = {}) {
  const { cwd = process.cwd() } = options;
  return execCommand('git', args, { cwd });
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
 * Read and parse a JSON file
 * @param {string} filePath - Absolute path to JSON file
 * @returns {Object} Parsed JSON object
 */
export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export { TESTS_ROOT, PLUGIN_ROOT };
