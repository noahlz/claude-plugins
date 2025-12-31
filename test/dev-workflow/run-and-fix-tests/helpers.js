import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { setupTestEnv, teardownTestEnv, readFixture } from '../../lib/helpers.js';

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
