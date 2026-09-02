import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  execGit,
  getPluginScriptPath,
  execNodeScript,
  extractJsonFromOutput
} from '../../lib/helpers.js';
import { setupGitRepo } from '../commit-with-costs/helpers.js';

export { setupTestEnv, teardownTestEnv, execGit, setupGitRepo };

/**
 * Create a mock git object for merge-workflow, with throwing defaults so an
 * unexpected call fails loudly rather than silently returning undefined.
 * @param {Object} overrides
 */
export function createMockGit(overrides = {}) {
  const throwUnexpected = (name) => () => {
    throw new Error(`Unexpected call to git.${name}`);
  };

  return {
    execGit: throwUnexpected('execGit'),
    commit: throwUnexpected('commit'),
    getHeadSha: throwUnexpected('getHeadSha'),
    getRepoRoot: () => '/repo',
    getLastCostCommitDate: () => null,
    listWorktrees: () => [],
    listUnmergedBranches: () => [],
    countCommitsAhead: () => 0,
    mergeNoCommit: throwUnexpected('mergeNoCommit'),
    mergeAbort: () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isMergeInProgress: () => false,
    listConflictedPaths: () => [],
    isLinkedWorktree: () => false,
    getMainWorktreePath: () => '/repo',
    getConfigValue: () => null,
    stagePaths: () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isMarkerFree: () => false,
    ...overrides
  };
}

/**
 * Create a mock ccusage object for merge-workflow.
 * @param {Object} overrides
 */
export function createMockCcusage(overrides = {}) {
  return {
    pwdToSessionId: (p) => `-${String(p).replace(/^\//, '').replace(/[^A-Za-z0-9]/g, '-')}`,
    findWorktreeSessionId: () => ({ sessionId: null, hasData: false, resolvedBy: 'none' }),
    hasSessionData: () => false,
    validateCostMetrics: (costs) => Array.isArray(costs) && costs.length > 0,
    filterZeroUsageCosts: (costs) => ({ filtered: costs, removed: [] }),
    ...overrides
  };
}

/**
 * Create a mock cost object for merge-workflow.
 * @param {Object} overrides
 */
export function createMockCost(overrides = {}) {
  return {
    computeCosts: async (sessionId, since) => ({
      success: true,
      method: since ? 'inc' : 'cum',
      since,
      costs: [{ model: 'test-model', cost: 1.5, in: 10, out: 20, cacheWrites: 0, cacheReads: 0 }]
    }),
    ...overrides
  };
}

/**
 * Assemble the full dependency object merge-workflow expects.
 */
export function createMockDeps({ git = {}, ccusage = {}, cost = {} } = {}) {
  return {
    git: createMockGit(git),
    ccusage: createMockCcusage(ccusage),
    cost: createMockCost(cost)
  };
}

/**
 * Write the shared commit-with-costs session config into a test repo.
 */
export function writeSessionConfig(testEnv, sessionId) {
  const dir = join(testEnv.tmpDir, '.claude');
  mkdirSync(dir, { recursive: true });
  const configPath = join(dir, 'settings.plugins.commit-with-costs.json');
  writeFileSync(configPath, JSON.stringify({ sessionId }), 'utf-8');
  return '.claude/settings.plugins.commit-with-costs.json';
}

/**
 * Commit a file on a named branch, returning to the original branch afterwards.
 */
export function commitOnBranch(testEnv, branch, filename, content) {
  const cwd = testEnv.tmpDir;
  const original = execGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).stdout.trim();

  const exists = execGit(['rev-parse', '--verify', '--quiet', branch], { cwd }).exitCode === 0;
  execGit(exists ? ['checkout', branch] : ['checkout', '-b', branch], { cwd });

  writeFileSync(join(cwd, filename), content);
  execGit(['add', filename], { cwd });
  execGit(['commit', '-m', `add ${filename}`], { cwd });

  execGit(['checkout', original], { cwd });
}

/**
 * Put two branches in conflict over the same file, leaving the repo on its original branch.
 * Returns the conflicted path.
 */
export function setupConflict(testEnv, { file = 'shared.txt', ours = 'from main', theirs = 'from feature', branch = 'feature-a' } = {}) {
  const cwd = testEnv.tmpDir;
  const original = execGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).stdout.trim();

  commitOnBranch(testEnv, branch, file, theirs);

  writeFileSync(join(cwd, file), ours);
  execGit(['add', file], { cwd });
  execGit(['commit', '-m', `${file} on ${original}`], { cwd });

  return file;
}

/**
 * Resolve a conflicted file by writing content free of conflict markers.
 */
export function writeResolution(testEnv, file, content) {
  writeFileSync(join(testEnv.tmpDir, file), content);
}

/**
 * Add a linked worktree for a branch and return its path.
 */
export function addWorktree(testEnv, branch, subdir = `.worktrees/${branch}`) {
  const path = join(testEnv.tmpDir, subdir);
  execGit(['worktree', 'add', path, branch], { cwd: testEnv.tmpDir });
  return path;
}

/**
 * Execute merge-workflow.js and parse its JSON result.
 */
export function execMergeWorkflow(testEnv, action, options = {}) {
  const scriptPath = getPluginScriptPath('dev-workflow', 'merge-with-costs', 'merge-workflow.js');

  const result = execNodeScript(scriptPath, {
    args: [action, ...(options.args || [])],
    cwd: options.cwd || testEnv.tmpDir,
    input: options.input
  });

  return { json: extractJsonFromOutput(result.stdout), raw: result };
}
