#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import * as git from '../../../lib/git-operations.js';
import * as ccusage from '../../../lib/ccusage-operations.js';
import { computeMergedCosts } from '../../../lib/cost-computation.js';
import { createCommit } from '../../../lib/commit-operations.js';
import { readSessionConfig } from '../../../lib/file-utils.js';
import { pathToFileURL } from 'url';

/**
 * Create default dependency objects for production use
 * @returns {object} Dependencies object with git, cost, and ccusage operations
 */
function createDefaultDeps() {
  return {
    git: {
      execGit: git.execGit,
      commit: git.commit,
      getHeadSha: git.getHeadSha,
      getRepoRoot: git.getRepoRoot,
      getLastCostCommitDate: git.getLastCostCommitDate,
      listWorktrees: git.listWorktrees,
      listUnmergedBranches: git.listUnmergedBranches,
      countCommitsAhead: git.countCommitsAhead,
      mergeNoCommit: git.mergeNoCommit,
      mergeAbort: git.mergeAbort,
      isMergeInProgress: git.isMergeInProgress,
      listConflictedPaths: git.listConflictedPaths
    },
    cost: {
      computeMergedCosts
    },
    ccusage: {
      pwdToSessionId: ccusage.pwdToSessionId,
      findWorktreeSessionId: ccusage.findWorktreeSessionId,
      hasSessionData: ccusage.hasSessionData,
      validateCostMetrics: ccusage.validateCostMetrics,
      filterZeroUsageCosts: ccusage.filterZeroUsageCosts
    }
  };
}

/**
 * Find branches that a sub-agent development session left behind, and the project session
 * that recorded each one's cost.
 *
 * A candidate is any local branch holding commits not reachable from HEAD. Live worktrees
 * supply their path directly; branches whose worktree was already removed fall back to
 * matching the project directory by branch name.
 *
 * @param {object} options - { baseDir, deps }
 * @returns {object} - { status, data: { repo_root, current_branch, candidates }, message }
 */
function discover(options = {}) {
  const { baseDir = '.', deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps, ccusage: ccusageOps } = deps;

  try {
    const repoRoot = gitOps.getRepoRoot({ cwd: baseDir });
    if (!repoRoot) {
      return { status: 'error', data: {}, message: 'Not inside a git repository' };
    }

    if (gitOps.isMergeInProgress({ cwd: baseDir })) {
      return {
        status: 'merge_in_progress',
        data: { repo_root: repoRoot },
        message: 'A merge is already in progress. Resolve or abort it before running this skill.'
      };
    }

    const currentBranch = gitOps.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: baseDir }).stdout.trim();

    const worktreeByBranch = new Map();
    for (const worktree of gitOps.listWorktrees({ cwd: baseDir })) {
      if (!worktree.isMain && worktree.branch) {
        worktreeByBranch.set(worktree.branch, worktree);
      }
    }

    const candidates = gitOps.listUnmergedBranches({ cwd: baseDir })
      .filter(branch => branch !== currentBranch)
      .map(branch => {
        const worktree = worktreeByBranch.get(branch) || null;
        const resolved = ccusageOps.findWorktreeSessionId(repoRoot, branch, worktree ? worktree.path : null);

        return {
          branch,
          worktree_path: worktree ? worktree.path : null,
          worktree_live: Boolean(worktree),
          worktree_locked: worktree ? worktree.locked : false,
          session_id: resolved.sessionId,
          resolved_by: resolved.resolvedBy,
          has_cost_data: resolved.hasData,
          commits_ahead: gitOps.countCommitsAhead(branch, { cwd: baseDir })
        };
      });

    return {
      status: candidates.length > 0 ? 'success' : 'no_candidates',
      data: { repo_root: repoRoot, current_branch: currentBranch, candidates },
      message: candidates.length > 0
        ? `Found ${candidates.length} unmerged branch(es)`
        : 'No unmerged branches found'
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Stage a merge of the given branches without committing.
 *
 * Two or more branches produce an octopus merge, which refuses to run at all when any
 * branch conflicts. On any failure the merge is aborted so the working tree is left clean.
 *
 * @param {object} options - { baseDir, branches, deps }
 * @returns {object} - { status, data, message }
 */
function merge(options = {}) {
  const { baseDir = '.', branches = [], deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps } = deps;

  if (branches.length === 0) {
    return { status: 'error', data: {}, message: 'No branches provided (use --branches a,b,c)' };
  }

  try {
    if (gitOps.isMergeInProgress({ cwd: baseDir })) {
      return { status: 'merge_in_progress', data: {}, message: 'A merge is already in progress' };
    }

    const result = gitOps.mergeNoCommit(branches, { cwd: baseDir });

    if (result.exitCode !== 0) {
      const conflicts = gitOps.listConflictedPaths({ cwd: baseDir });
      gitOps.mergeAbort({ cwd: baseDir });
      return {
        status: 'merge_failed',
        data: { branches, conflicts, git_output: `${result.stdout}${result.stderr}`.trim() },
        message: conflicts.length > 0
          ? `Merge conflicts in ${conflicts.length} path(s); merge aborted`
          : 'Merge failed; merge aborted'
      };
    }

    // An octopus merge that fast-forwards or has nothing to do leaves no MERGE_HEAD,
    // so there is no merge commit for the caller to create.
    if (!gitOps.isMergeInProgress({ cwd: baseDir })) {
      return {
        status: 'nothing_to_merge',
        data: { branches, git_output: result.stdout.trim() },
        message: 'Merge left no staged merge commit'
      };
    }

    return {
      status: 'success',
      data: { branches, git_output: result.stdout.trim() },
      message: `Staged merge of ${branches.length} branch(es); ready to commit`
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Abort an in-progress merge.
 * @param {object} options - { baseDir, deps }
 */
function abort(options = {}) {
  const { baseDir = '.', deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const result = deps.git.mergeAbort({ cwd: baseDir });
  return result.exitCode === 0
    ? { status: 'success', data: {}, message: 'Merge aborted' }
    : { status: 'error', data: { error_message: result.stderr }, message: 'Failed to abort merge' };
}

/**
 * Pool cost metrics for a merge commit.
 *
 * Each merged worktree ran as its own project session and its commits carry no cost trailer,
 * so its whole session is counted (cumulative). The orchestrator session contributes only
 * what it spent since its own last cost-trailered commit, which is what keeps the merge
 * commit from re-counting work already attributed on this branch.
 *
 * @param {object} options - { baseDir, configPath, branches, deps }
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepareMerge(options = {}) {
  const { baseDir = '.', configPath, branches = [], deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps, ccusage: ccusageOps, cost: costOps } = deps;

  try {
    const config = readSessionConfig(configPath);
    const orchestratorSessionId = config.sessionId;

    if (!orchestratorSessionId) {
      return { status: 'not_found', data: {}, message: `No sessionId in ${configPath}` };
    }

    const repoRoot = gitOps.getRepoRoot({ cwd: baseDir });
    if (!repoRoot) {
      return { status: 'error', data: {}, message: 'Not inside a git repository' };
    }

    const sources = [];
    const unresolved = [];

    for (const branch of branches) {
      const resolved = ccusageOps.findWorktreeSessionId(repoRoot, branch, null);

      if (!resolved.sessionId || !resolved.hasData) {
        unresolved.push({ branch, session_id: resolved.sessionId, reason: resolved.sessionId ? 'no_cost_data' : 'no_session' });
        continue;
      }

      // Worktree branch commits carry no cost trailer, so there is nothing to anchor
      // against and the branch's whole session belongs to this merge.
      sources.push({ label: branch, sessionId: resolved.sessionId, since: null });
    }

    const orchestratorSince = gitOps.getLastCostCommitDate(orchestratorSessionId, { cwd: baseDir });
    sources.push({ label: 'orchestrator', sessionId: orchestratorSessionId, since: orchestratorSince });

    const costResult = await costOps.computeMergedCosts(sources);

    if (!costResult.success) {
      return { status: 'error', data: { session_id: orchestratorSessionId }, message: costResult.error };
    }

    if (!ccusageOps.validateCostMetrics(costResult.costs)) {
      return {
        status: 'invalid_costs',
        data: { session_id: orchestratorSessionId, costs: costResult.costs, unresolved },
        message: 'Cost metrics validation failed: metrics are empty, missing required fields, or all values are zero'
      };
    }

    return {
      status: 'success',
      data: {
        session_id: orchestratorSessionId,
        method: 'merge',
        since: orchestratorSince,
        current_cost: costResult.costs,
        contributions: costResult.contributions,
        unresolved
      },
      message: `Pooled costs from ${sources.length} session(s)`
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Create the merge commit. Requires MERGE_HEAD to be present.
 * @param {object} options - { baseDir, configPath, costs, since, message, deps }
 */
async function commitMerge(options = {}) {
  const { baseDir = '.', configPath, costs, since, message, deps } = options;
  if (!deps) throw new Error('deps parameter required');

  if (!deps.git.isMergeInProgress({ cwd: baseDir })) {
    return { status: 'no_merge_in_progress', data: {}, message: 'No staged merge to commit (MERGE_HEAD absent)' };
  }

  const config = readSessionConfig(configPath);

  return createCommit({
    baseDir,
    sessionId: config.sessionId,
    costs,
    method: 'merge',
    since,
    message,
    deps
  });
}

/**
 * Read a flag's value from an argument list.
 */
function flagValue(args, name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
}

/**
 * CLI entry point
 */
/* node:coverage disable */
async function main() {
  const action = process.argv[2];
  const args = process.argv.slice(3);
  const deps = createDefaultDeps();

  const branches = (flagValue(args, '--branches') || '')
    .split(',')
    .map(b => b.trim())
    .filter(Boolean);

  let result;

  try {
    switch (action) {
      case 'discover':
        result = discover({ baseDir: '.', deps });
        break;

      case 'merge':
        result = merge({ baseDir: '.', branches, deps });
        break;

      case 'abort':
        result = abort({ baseDir: '.', deps });
        break;

      case 'prepare-merge':
        result = await prepareMerge({
          baseDir: '.',
          configPath: flagValue(args, '--config'),
          branches,
          deps
        });
        break;

      case 'commit':
        result = await commitMerge({
          baseDir: '.',
          configPath: flagValue(args, '--config'),
          costs: flagValue(args, '--costs'),
          since: flagValue(args, '--since') || null,
          deps
        });
        break;

      default:
        result = { status: 'error', data: {}, message: `Unknown action: ${action}` };
        break;
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', data: {}, message: error.message }, null, 2));
    process.exit(1);
  }
}

export { discover, merge, abort, prepareMerge, commitMerge };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.log(JSON.stringify({ status: 'error', data: {}, message: err.message }, null, 2));
    process.exit(1);
  });
}
/* node:coverage enable */
