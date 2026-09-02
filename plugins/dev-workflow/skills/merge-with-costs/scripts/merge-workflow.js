#!/usr/bin/env node

import path from 'path';
import * as git from '../../../lib/git-operations.js';
import * as ccusage from '../../../lib/ccusage-operations.js';
import { computeCosts } from '../../../lib/cost-computation.js';
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
      listConflictedPaths: git.listConflictedPaths,
      isLinkedWorktree: git.isLinkedWorktree,
      getMainWorktreePath: git.getMainWorktreePath,
      getConfigValue: git.getConfigValue,
      stagePaths: git.stagePaths,
      isMarkerFree: git.isMarkerFree
    },
    cost: {
      computeCosts
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
 * Paths git settled from a recorded rerere resolution, read from its merge output.
 *
 * Depending on `rerere.autoUpdate` git either leaves the replayed file unmerged ("Resolved")
 * or stages it itself ("Staged"), so the index cannot be relied on to show the work rerere did.
 *
 * @param {string} gitOutput
 * @returns {Array<string>}
 */
function parseRerereReplays(gitOutput) {
  return [...gitOutput.matchAll(/^(?:Resolved|Staged) '(.+)' using previous resolution\.$/gm)]
    .map(match => match[1]);
}

/**
 * True when rerere is switched on for this repository.
 */
function rerereEnabled(gitOps, options) {
  return gitOps.getConfigValue('rerere.enabled', options) === 'true';
}

/**
 * Split unmerged paths into those a recorded rerere resolution already wrote out and those
 * still holding conflict markers.
 *
 * rerere applies its resolution to the working file but leaves the index entry unmerged, so
 * the file content is the only way to tell the two apart.
 *
 * @returns {{ resolved: Array<string>, unresolved: Array<string> }}
 */
function partitionConflicts(gitOps, baseDir) {
  const resolved = [];
  const unresolved = [];

  for (const relPath of gitOps.listConflictedPaths({ cwd: baseDir })) {
    if (gitOps.isMarkerFree(path.resolve(baseDir, relPath))) {
      resolved.push(relPath);
    } else {
      unresolved.push(relPath);
    }
  }

  return { resolved, unresolved };
}

/**
 * Check that this run can produce correct cost metrics before anything is merged.
 *
 * Cost is read from one project session, and Claude Code keys a project session to the
 * directory the session was launched from. A run inside a linked worktree therefore reads a
 * different session than the one the config names, so both conditions are refusals rather
 * than warnings.
 *
 * @param {object} options - { baseDir, configPath, deps }
 * @returns {object} - { status, data, message }
 */
function preflight(options = {}) {
  const { baseDir = '.', configPath, deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps, ccusage: ccusageOps } = deps;

  try {
    const repoRoot = gitOps.getRepoRoot({ cwd: baseDir });
    if (!repoRoot) {
      return { status: 'error', data: {}, message: 'Not inside a git repository' };
    }

    const config = configPath ? readSessionConfig(configPath) : {};
    const configSessionId = config.sessionId || null;
    const cwdSessionId = ccusageOps.pwdToSessionId(path.resolve(baseDir));
    const repoSessionId = ccusageOps.pwdToSessionId(path.resolve(repoRoot));

    // A session launched in a subdirectory of the repository is keyed to that subdirectory,
    // so either encoding is a legitimate match for the configured session.
    const sessionMatches = Boolean(configSessionId)
      && (configSessionId === cwdSessionId || configSessionId === repoSessionId);

    const data = {
      repo_root: repoRoot,
      in_linked_worktree: gitOps.isLinkedWorktree({ cwd: baseDir }),
      main_worktree_path: gitOps.getMainWorktreePath({ cwd: baseDir }),
      config_session_id: configSessionId,
      cwd_session_id: cwdSessionId,
      repo_session_id: repoSessionId,
      session_matches: sessionMatches,
      rerere_enabled: rerereEnabled(gitOps, { cwd: baseDir })
    };

    if (data.in_linked_worktree) {
      return {
        status: 'in_worktree',
        data,
        message: `Running inside a linked worktree. Cost is recorded against the project-root session, so run this skill from the main working tree: ${data.main_worktree_path}`
      };
    }

    if (!sessionMatches) {
      return {
        status: 'session_mismatch',
        data,
        message: configSessionId
          ? `Configured session "${configSessionId}" is not this project directory ("${cwdSessionId}"). Cost would be read from the wrong session.`
          : 'No sessionId in the commit-with-costs config'
      };
    }

    return { status: 'success', data, message: 'Ready to merge' };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Find branches that a sub-agent development session left behind, and report whether any of
 * them was worked on from a Claude session launched inside its own worktree.
 *
 * A candidate is any local branch holding commits not reachable from HEAD. Cost never comes
 * from a worktree session — a worktree session that still holds transcripts means cost this
 * merge cannot account for, which the caller must raise before merging.
 *
 * @param {object} options - { baseDir, deps }
 * @returns {object} - { status, data: { repo_root, current_branch, candidates, unaccounted_sessions }, message }
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
          worktree_session_id: resolved.sessionId,
          resolved_by: resolved.resolvedBy,
          worktree_session_has_data: resolved.hasData,
          commits_ahead: gitOps.countCommitsAhead(branch, { cwd: baseDir })
        };
      });

    const unaccountedSessions = candidates
      .filter(candidate => candidate.worktree_session_has_data)
      .map(({ branch, worktree_session_id }) => ({ branch, session_id: worktree_session_id }));

    return {
      status: candidates.length > 0 ? 'success' : 'no_candidates',
      data: {
        repo_root: repoRoot,
        current_branch: currentBranch,
        candidates,
        unaccounted_sessions: unaccountedSessions
      },
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
 * A conflicted single-branch merge is left in place for resolution — MERGE_HEAD and the
 * conflicted index survive. An octopus merge of two or more branches refuses to start at all
 * when any branch conflicts, leaving nothing to resolve, so that case is rolled back instead.
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
    const gitOutput = `${result.stdout}${result.stderr}`.trim();

    if (result.exitCode !== 0) {
      // A failed octopus merge has already fast-forwarded to its first branch and left a
      // half-merged tree whose files carry no conflict markers — there is nothing safe to
      // resolve in place. Same when no MERGE_HEAD survives. Roll both back.
      if (branches.length > 1 || !gitOps.isMergeInProgress({ cwd: baseDir })) {
        gitOps.mergeAbort({ cwd: baseDir });
        return {
          status: 'merge_failed',
          data: { branches, conflicts: [], git_output: gitOutput },
          message: branches.length > 1
            ? 'Octopus merge failed and was rolled back. Re-run one branch at a time so conflicts can be resolved.'
            : 'Merge failed before staging anything; rolled back'
        };
      }

      const { resolved, unresolved } = partitionConflicts(gitOps, baseDir);
      if (resolved.length > 0) {
        gitOps.stagePaths(resolved, { cwd: baseDir });
      }

      const settled = [...new Set([...parseRerereReplays(gitOutput), ...resolved])];

      if (unresolved.length === 0) {
        return {
          status: 'success',
          data: { branches, resolved_by_rerere: settled, git_output: gitOutput },
          message: `Recorded resolutions settled ${settled.length} conflicted path(s); ready to commit`
        };
      }

      return {
        status: 'merge_conflicts',
        data: {
          branches,
          resolved_by_rerere: settled,
          unresolved,
          rerere_enabled: rerereEnabled(gitOps, { cwd: baseDir }),
          git_output: gitOutput
        },
        message: `${unresolved.length} path(s) need resolution; the merge is staged and waiting`
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
      data: { branches, resolved_by_rerere: [], git_output: result.stdout.trim() },
      message: `Staged merge of ${branches.length} branch(es); ready to commit`
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Report what a staged merge still needs before it can be committed.
 * @param {object} options - { baseDir, deps }
 */
function resolveStatus(options = {}) {
  const { baseDir = '.', deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps } = deps;

  if (!gitOps.isMergeInProgress({ cwd: baseDir })) {
    return { status: 'no_merge_in_progress', data: {}, message: 'No staged merge (MERGE_HEAD absent)' };
  }

  const { resolved, unresolved } = partitionConflicts(gitOps, baseDir);

  return {
    status: 'success',
    data: {
      ready_to_stage: resolved,
      unresolved,
      rerere_enabled: rerereEnabled(gitOps, { cwd: baseDir })
    },
    message: unresolved.length === 0
      ? `${resolved.length} path(s) ready to stage; no conflict markers remain`
      : `${unresolved.length} path(s) still hold conflict markers`
  };
}

/**
 * Stage resolved paths, refusing any that still hold conflict markers.
 *
 * The call is all-or-nothing: a half-staged merge is harder to reason about than a refusal.
 *
 * @param {object} options - { baseDir, paths, deps }
 */
function stageResolved(options = {}) {
  const { baseDir = '.', paths = [], deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps } = deps;

  if (!gitOps.isMergeInProgress({ cwd: baseDir })) {
    return { status: 'no_merge_in_progress', data: {}, message: 'No staged merge (MERGE_HEAD absent)' };
  }

  const { resolved, unresolved } = partitionConflicts(gitOps, baseDir);
  const requested = paths.length > 0 ? paths : resolved;

  if (requested.length === 0) {
    return {
      status: 'nothing_to_stage',
      data: { unresolved },
      message: 'No resolved paths to stage'
    };
  }

  const stillConflicted = requested.filter(p => unresolved.includes(p));
  if (stillConflicted.length > 0) {
    return {
      status: 'markers_present',
      data: { unresolved: stillConflicted },
      message: `Refusing to stage ${stillConflicted.length} path(s) that still hold conflict markers`
    };
  }

  const result = gitOps.stagePaths(requested, { cwd: baseDir });
  if (result.exitCode !== 0) {
    return { status: 'git_error', data: { error_message: result.stderr }, message: 'Failed to stage resolved paths' };
  }

  const remaining = gitOps.listConflictedPaths({ cwd: baseDir });

  return {
    status: 'success',
    data: { staged: requested, remaining },
    message: remaining.length === 0
      ? 'All conflicts resolved; ready to commit'
      : `${remaining.length} path(s) still unmerged`
  };
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
 * Compute the cost metrics for a merge commit.
 *
 * Cost comes from one session: the project-root session the merge is run from. Work a
 * sub-agent did inside a worktree is written to the transcripts of the session that
 * dispatched it, so it is already included; only a Claude session launched inside a worktree
 * records elsewhere, and `preflight` and `discover` refuse that case rather than guessing.
 *
 * The window opens at the session's own last cost-trailered commit, so work already
 * attributed on this branch is never counted twice.
 *
 * @param {object} options - { baseDir, configPath, deps }
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepareMerge(options = {}) {
  const { baseDir = '.', configPath, deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps, ccusage: ccusageOps, cost: costOps } = deps;

  try {
    // readSessionConfig throws when the file is missing or carries no sessionId
    const { sessionId } = readSessionConfig(configPath);

    const since = gitOps.getLastCostCommitDate(sessionId, { cwd: baseDir });
    const costResult = await costOps.computeCosts(sessionId, since);

    if (!costResult.success) {
      return { status: 'error', data: { session_id: sessionId }, message: costResult.error };
    }

    if (!ccusageOps.validateCostMetrics(costResult.costs)) {
      return {
        status: 'invalid_costs',
        data: { session_id: sessionId, costs: costResult.costs },
        message: 'Cost metrics validation failed: metrics are empty, missing required fields, or all values are zero'
      };
    }

    const data = {
      session_id: sessionId,
      method: 'merge',
      since,
      current_cost: costResult.costs,
      anchored: Boolean(since)
    };

    // Without an anchor the figure is everything the project session has ever recorded, which
    // is almost never what one merge commit should claim. Hand it back for confirmation
    // rather than writing it.
    if (!since) {
      return {
        status: 'no_anchor',
        data,
        message: 'No previous commit carries a cost trailer for this session, so these costs cover the whole session'
      };
    }

    return { status: 'success', data, message: `Costs computed since ${since}` };
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

  const unmerged = deps.git.listConflictedPaths({ cwd: baseDir });
  if (unmerged.length > 0) {
    return {
      status: 'conflicts_unresolved',
      data: { unresolved: unmerged },
      message: `${unmerged.length} path(s) are still unmerged; resolve and stage them first`
    };
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
 * Split a comma-separated flag value into trimmed, non-empty entries.
 */
function flagList(args, name) {
  return (flagValue(args, name) || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * CLI entry point
 */
/* node:coverage disable */
async function main() {
  const action = process.argv[2];
  const args = process.argv.slice(3);
  const deps = createDefaultDeps();

  const branches = flagList(args, '--branches');

  let result;

  try {
    switch (action) {
      case 'preflight':
        result = preflight({ baseDir: '.', configPath: flagValue(args, '--config'), deps });
        break;

      case 'discover':
        result = discover({ baseDir: '.', deps });
        break;

      case 'merge':
        result = merge({ baseDir: '.', branches, deps });
        break;

      case 'resolve-status':
        result = resolveStatus({ baseDir: '.', deps });
        break;

      case 'stage-resolved':
        result = stageResolved({ baseDir: '.', paths: flagList(args, '--paths'), deps });
        break;

      case 'abort':
        result = abort({ baseDir: '.', deps });
        break;

      case 'prepare-merge':
        result = await prepareMerge({
          baseDir: '.',
          configPath: flagValue(args, '--config'),
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

export { preflight, discover, merge, resolveStatus, stageResolved, abort, prepareMerge, commitMerge };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.log(JSON.stringify({ status: 'error', data: {}, message: err.message }, null, 2));
    process.exit(1);
  });
}
/* node:coverage enable */
