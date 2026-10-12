#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as git from '../../../lib/git-operations.js';
import * as ccusage from '../../../lib/ccusage-operations.js';
import { computePooledCosts } from '../../../lib/cost-computation.js';
import { createCommit } from '../../../lib/commit-operations.js';
import { readSessionConfig } from '../../../lib/file-utils.js';
import { skillConfigPath } from '../../../lib/skill-config.js';
import { pathToFileURL } from 'url';

// merge-with-costs shares commit-with-costs configuration
const CONFIG_SKILL = 'commit-with-costs';

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
      computePooledCosts
    },
    ccusage: {
      pwdToSessionId: ccusage.pwdToSessionId,
      findWorktreeSessionId: ccusage.findWorktreeSessionId,
      hasSessionData: ccusage.hasSessionData,
      listWorktreeSessions: ccusage.listWorktreeSessions,
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
 * than warnings. Worktree sessions active since the last cost commit are reported in
 * `worktree_sessions` as a warning: their cost is missed unless the user includes it later.
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

    const worktreeData = {
      repo_root: repoRoot,
      in_linked_worktree: gitOps.isLinkedWorktree({ cwd: baseDir }),
      main_worktree_path: gitOps.getMainWorktreePath({ cwd: baseDir })
    };

    // Checked before the config: a linked worktree has its own project root, so its config
    // is usually absent, and "not configured" would hide the real problem.
    if (worktreeData.in_linked_worktree) {
      return {
        status: 'in_worktree',
        data: worktreeData,
        message: `Running inside a linked worktree. Cost is recorded against the project-root session, so run this skill from the main working tree: ${worktreeData.main_worktree_path}`
      };
    }

    if (!configPath || !fs.existsSync(configPath)) {
      return {
        status: 'not_configured',
        data: { ...worktreeData, config_path: configPath || null },
        message: 'No commit-with-costs config for this project. Run /commit-with-costs once to create it.'
      };
    }

    const configSessionId = readSessionConfig(configPath).sessionId;
    const cwdSessionId = ccusageOps.pwdToSessionId(path.resolve(baseDir));
    const repoSessionId = ccusageOps.pwdToSessionId(path.resolve(repoRoot));

    // A session launched in a subdirectory of the repository is keyed to that subdirectory,
    // so either encoding is a legitimate match for the configured session.
    const sessionMatches = configSessionId === cwdSessionId || configSessionId === repoSessionId;

    const data = {
      ...worktreeData,
      config_session_id: configSessionId,
      cwd_session_id: cwdSessionId,
      repo_session_id: repoSessionId,
      session_matches: sessionMatches,
      rerere_enabled: rerereEnabled(gitOps, { cwd: baseDir })
    };

    if (!sessionMatches) {
      return {
        status: 'session_mismatch',
        data,
        message: `Configured session "${configSessionId}" is not this project directory ("${cwdSessionId}"). Cost would be read from the wrong session.`
      };
    }

    // Warn before anything is merged: a worktree session active since the last cost commit
    // holds cost the project session cannot see (EnterWorktree re-keys the whole transcript).
    const anchor = gitOps.getLastCostCommitDate(configSessionId, { cwd: baseDir });
    data.worktree_sessions = ccusageOps.listWorktreeSessions(configSessionId)
      .filter(s => !anchor || Date.parse(s.lastActivity) > Date.parse(anchor))
      .map(s => ({ session_id: s.sessionId, last_activity: s.lastActivity }));

    return { status: 'success', data, message: 'Ready to merge' };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Find branches that a sub-agent development session left behind, and report whether any of
 * them was worked on from a Claude session launched inside its own worktree.
 *
 * A candidate is any local branch holding commits not reachable from HEAD. A worktree session
 * that still holds transcripts is cost the project session does not see; it is reported in
 * `unaccounted_sessions` so the caller can raise it before merging and, if the user chooses,
 * pool it into the merge cost via `prepare-merge --include-sessions`.
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
 * Latest of several ISO 8601 dates, ignoring nulls; null when none is set.
 * Compared as instants because anchors carry different timezone offsets.
 */
function latestDate(...dates) {
  return dates
    .filter(Boolean)
    .reduce((latest, d) => (latest === null || Date.parse(d) > Date.parse(latest) ? d : latest), null);
}

/**
 * Compute the cost metrics for a merge commit.
 *
 * Cost comes from the project-root session the merge is run from, plus any worktree sessions
 * the user chose to include. Work a sub-agent did inside a worktree is written to the
 * transcripts of the session that dispatched it, so it is already included. A session that
 * recorded under a worktree's own project directory (`EnterWorktree`, or a Claude session
 * launched inside the worktree) is counted only when named in `includeSessions`.
 *
 * Each window opens at its session's last cost-trailered commit, so work already attributed is
 * never counted twice. The project window walks HEAD only. An included session's window also
 * walks the branches being merged, where a worktree-launched session's own trailers live, and
 * by default never opens before the project anchor: an `EnterWorktree` transcript can span the
 * previous merge, whose trailer already counted its earlier entries. That floor can also drop
 * cost nobody counted, so whatever it drops is measured and returned as `excluded`; naming the
 * session in `noFloor` opens its window at its own anchor instead.
 *
 * `since` and `until` re-measure a past window, e.g. to correct a merge trailer. `since`
 * replaces the project anchor, and therefore the floor. `until` caps every window (inclusive).
 * An included session's anchor at or after `until` belongs to the commit being re-measured or
 * a later one, so it is disregarded.
 *
 * @param {object} options - { baseDir, configPath, includeSessions, noFloor, branches, since, until, deps }
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepareMerge(options = {}) {
  const {
    baseDir = '.', configPath, includeSessions = [], noFloor = [], branches = [],
    since: sinceOverride = null, until = null, deps
  } = options;
  if (!deps) throw new Error('deps parameter required');

  const { git: gitOps, ccusage: ccusageOps, cost: costOps } = deps;

  const unparseable = [sinceOverride, until].find(d => d && Number.isNaN(Date.parse(d)));
  if (unparseable) {
    return { status: 'invalid_range', data: { since: sinceOverride, until }, message: `${unparseable} is not an ISO 8601 date` };
  }

  try {
    // readSessionConfig throws when the file is missing or carries no sessionId
    const { sessionId } = readSessionConfig(configPath);

    // A worktree session id is the project id followed by the encoded worktree subpath
    const invalid = includeSessions.find(id => !id.startsWith(`${sessionId}-`) || !ccusageOps.hasSessionData(id));
    if (invalid) {
      return {
        status: 'invalid_session',
        data: { session_id: invalid },
        message: `${invalid} is not a worktree session of ${sessionId} with recorded usage`
      };
    }

    const since = sinceOverride ?? gitOps.getLastCostCommitDate(sessionId, { cwd: baseDir, revs: ['HEAD'] });
    if (until && since && Date.parse(until) <= Date.parse(since)) {
      return {
        status: 'invalid_range',
        data: { since, until },
        message: `--until ${until} must be later than since ${since}`
      };
    }

    const isAtOrAfterUntil = (date) => Boolean(until && date && Date.parse(date) >= Date.parse(until));
    const cap = until ? { until } : {};

    const included = [];
    for (const id of includeSessions) {
      const ownAnchor = gitOps.getLastCostCommitDate(id, { cwd: baseDir, revs: ['HEAD', ...branches] });
      const ownSince = isAtOrAfterUntil(ownAnchor) ? null : ownAnchor;
      const floored = latestDate(since, ownSince);

      if (floored === ownSince || noFloor.includes(id)) {
        included.push({ session_id: id, since: ownSince });
        continue;
      }

      // The floor drops (ownSince, since]. Measure it so the user decides whether the previous
      // merge already counted it (EnterWorktree) or nobody did (session launched in the worktree).
      const dropped = await costOps.computePooledCosts([{ sessionId: id, since: ownSince, until: since }]);
      if (!dropped.success) {
        return { status: 'error', data: { session_id: id }, message: dropped.error };
      }
      included.push({
        session_id: id,
        since: floored,
        ...(dropped.costs.length ? { excluded: { since: ownSince, until: since, cost: dropped.costs } } : {})
      });
    }

    const costResult = await costOps.computePooledCosts([
      { sessionId, since, ...cap },
      ...included.map(w => ({ sessionId: w.session_id, since: w.since, ...cap }))
    ]);

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
      until,
      current_cost: costResult.costs,
      anchored: Boolean(since),
      included_sessions: included
    };

    // Without a project anchor the figure is everything the project session has ever recorded,
    // which is almost never what one merge commit should claim. Hand it back for confirmation
    // rather than writing it.
    if (!since) {
      return {
        status: 'no_anchor',
        data,
        message: 'No previous commit carries a cost trailer for this session, so these costs cover the whole session'
      };
    }

    return { status: 'success', data, message: `Costs computed since ${since}${until ? ` until ${until}` : ''}` };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Create the merge commit. Requires MERGE_HEAD to be present.
 * @param {object} options - { baseDir, configPath, costs, since, pooled, message, deps }
 */
async function commitMerge(options = {}) {
  const { baseDir = '.', configPath, costs, since, pooled = [], message, deps } = options;
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
    pooled,
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
        result = preflight({ baseDir: '.', configPath: skillConfigPath(CONFIG_SKILL), deps });
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
          configPath: skillConfigPath(CONFIG_SKILL),
          includeSessions: flagList(args, '--include-sessions'),
          noFloor: flagList(args, '--no-floor'),
          branches,
          since: flagValue(args, '--since') || null,
          until: flagValue(args, '--until') || null,
          deps
        });
        break;

      case 'commit':
        result = await commitMerge({
          baseDir: '.',
          configPath: skillConfigPath(CONFIG_SKILL),
          costs: flagValue(args, '--costs'),
          since: flagValue(args, '--since') || null,
          pooled: flagList(args, '--pooled'),
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
