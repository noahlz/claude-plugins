import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import {
  setupTestEnv,
  teardownTestEnv,
  execGit,
  getPluginScriptPath,
  execNodeScript,
  extractJsonFromOutput
} from '../../lib/helpers.js';

// Re-export generic helpers for convenience
export { setupTestEnv, teardownTestEnv, execGit };

// ============================================================================
// Mock Creation Helpers
// ============================================================================

/**
 * Create a mock ccusage object with specified overrides
 * @param {Object} overrides - Methods to override
 * @returns {Object} Mock ccusage with throwing defaults
 */
export function createMockCcusage(overrides = {}) {
  const throwUnexpected = (name) => {
    throw new Error(`Unexpected call to ccusage.${name}`);
  };

  return {
    loadSessionData: async () => throwUnexpected('loadSessionData'),
    getProjectsDir: () => throwUnexpected('getProjectsDir'),
    getSessionCosts: async () => throwUnexpected('getSessionCosts'),
    listLocalSessions: () => throwUnexpected('listLocalSessions'),
    findRecommendedSession: () => throwUnexpected('findRecommendedSession'),
    pwdToSessionId: () => throwUnexpected('pwdToSessionId'),
    extractCostMetrics: () => throwUnexpected('extractCostMetrics'),
    validateCostMetrics: () => throwUnexpected('validateCostMetrics'),
    ...overrides
  };
}

/**
 * Create a mock git object with specified overrides
 * @param {Object} overrides - Methods to override
 * @returns {Object} Mock git with throwing defaults
 */
export function createMockGit(overrides = {}) {
  const throwUnexpected = (name) => {
    throw new Error(`Unexpected call to git.${name}`);
  };

  return {
    execGit: () => throwUnexpected('execGit'),
    commit: () => throwUnexpected('commit'),
    getHeadSha: () => throwUnexpected('getHeadSha'),
    ...overrides
  };
}

/**
 * Create a mock loadSessionData function that returns specified sessions
 * @param {Array} sessions - Array of session objects to return
 * @returns {Function} Async mock function that returns the sessions
 */
export function createMockLoadSessionData(sessions) {
  return async () => sessions;
}

// ============================================================================
// Result Assertion Helpers
// ============================================================================

/**
 * Assert on workflow result status and basic structure
 * @param {Object} result - Workflow result object
 * @param {string} expectedStatus - Expected status value
 * @param {Object} checks - Additional checks { hasData, hasMessage, dataChecks }
 */
export function assertResultStatus(result, expectedStatus, checks = {}) {
  assert.equal(result.status, expectedStatus, `Status should be ${expectedStatus}`);

  if (checks.hasData !== false) {
    assert.ok(result.data, 'Should have data property');
  }

  if (checks.hasMessage) {
    assert.ok(result.message, 'Should have message property');
    if (checks.messagePattern) {
      assert.match(result.message, checks.messagePattern, 'Message should match pattern');
    }
  }

  if (checks.dataChecks) {
    for (const [key, value] of Object.entries(checks.dataChecks)) {
      if (value instanceof RegExp) {
        assert.match(result.data[key], value, `data.${key} should match pattern`);
      } else {
        assert.equal(result.data[key], value, `data.${key} should equal ${value}`);
      }
    }
  }
}

// ============================================================================
// Integration Test Helpers
// ============================================================================

/**
 * Initialize a git repository in test environment
 * @param {Object} testEnv - Test environment from setupTestEnv
 */
export function setupGitRepo(testEnv) {
  execGit(['init'], { cwd: testEnv.tmpDir });
  execGit(['config', 'user.email', 'test@example.com'], { cwd: testEnv.tmpDir });
  execGit(['config', 'user.name', 'Test User'], { cwd: testEnv.tmpDir });

  // Create initial commit
  writeFileSync(join(testEnv.tmpDir, 'initial.txt'), 'initial');
  execGit(['add', 'initial.txt'], { cwd: testEnv.tmpDir });
  execGit(['commit', '-m', 'initial commit'], { cwd: testEnv.tmpDir });
}

/**
 * Write a file and stage it with git
 * @param {Object} testEnv - Test environment
 * @param {string} filename - File name to create
 * @param {string} content - File content
 */
export function stageFile(testEnv, filename, content = 'test content') {
  writeFileSync(join(testEnv.tmpDir, filename), content);
  execGit(['add', filename], { cwd: testEnv.tmpDir });
}

/**
 * Execute commit-workflow.js script and parse JSON result
 * @param {Object} testEnv - Test environment
 * @param {string} action - Action to execute (prepare, commit, save-config)
 * @param {Object} options - { args, input }
 * @returns {Object} Parsed JSON result
 */
export function execCommitWorkflow(testEnv, action, options = {}) {
  const scriptPath = getPluginScriptPath('dev-workflow', 'write-git-commit', 'commit-workflow.js');

  const result = execNodeScript('dev-workflow', scriptPath, {
    args: [action, ...(options.args || [])],
    cwd: testEnv.tmpDir,
    input: options.input
  });

  return extractJsonFromOutput(result.stdout);
}

/**
 * Assert on commit message in git log
 * @param {Object} testEnv - Test environment
 * @param {string} expectedSubject - Expected commit subject
 * @param {Array<string>} expectedBodyParts - Parts expected in commit body
 */
export function assertCommitMessage(testEnv, expectedSubject, expectedBodyParts = []) {
  const gitLogResult = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir });

  assert.ok(gitLogResult.stdout.includes(expectedSubject),
    `Commit should contain subject: ${expectedSubject}`);

  expectedBodyParts.forEach(part => {
    assert.ok(gitLogResult.stdout.includes(part),
      `Commit should contain: ${part}`);
  });
}

/**
 * Create valid cost metrics for testing
 * @param {Object} overrides - Override defaults
 * @returns {Array} Cost metrics array
 */
export function createValidCosts(overrides = {}) {
  return [{
    model: 'test-model',
    inputTokens: 100,
    outputTokens: 50,
    cost: 0.05,
    ...overrides
  }];
}
