import { writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
