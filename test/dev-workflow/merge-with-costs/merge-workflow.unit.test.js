import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  preflight,
  discover,
  merge,
  resolveStatus,
  stageResolved,
  abort,
  prepareMerge
} from '../../../plugins/dev-workflow/skills/merge-with-costs/scripts/merge-workflow.js';
import { createMockDeps } from './helpers.js';

const OK = { stdout: '', stderr: '', exitCode: 0 };
const FAIL = { stdout: '', stderr: 'conflict', exitCode: 1 };

// The fixture config names session "-repo", which the mock encoder derives from "/repo".
const CONFIG = 'test/dev-workflow/merge-with-costs/fixtures/session-config.json';
const REPO = '/repo';
const MISSING_CONFIG = 'test/dev-workflow/merge-with-costs/fixtures/does-not-exist.json';

const headIs = (branch) => ({ execGit: () => ({ ...OK, stdout: `${branch}\n` }) });

/**
 * Run merge() against a merge that fails with the given conflicted paths, tracking aborts.
 */
function mergeWithConflicts({ conflicted, mergeHeadSurvives, markerFree = [], branches = ['a'], gitOutput = '' }) {
  const staged = [];
  let aborted = false;
  let started = false;
  let remaining = [...conflicted];

  const deps = createMockDeps({
    git: {
      isMergeInProgress: () => started && mergeHeadSurvives,
      mergeNoCommit: () => { started = true; return { ...FAIL, stdout: gitOutput }; },
      listConflictedPaths: () => remaining,
      isMarkerFree: (absPath) => markerFree.some(p => absPath.endsWith(p)),
      stagePaths: (paths) => {
        staged.push(...paths);
        remaining = remaining.filter(p => !paths.includes(p));
        return OK;
      },
      mergeAbort: () => { aborted = true; return OK; }
    }
  });

  return { result: merge({ branches, deps }), staged, aborted: () => aborted };
}

describe('merge-with-costs/merge-workflow.js', () => {
  describe('preflight', () => {
    it('reports in_worktree before reading a config that does not exist', () => {
      const deps = createMockDeps({
        git: { isLinkedWorktree: () => true, getMainWorktreePath: () => '/repo' }
      });

      const result = preflight({ baseDir: REPO, configPath: MISSING_CONFIG, deps });

      assert.equal(result.status, 'in_worktree');
    });

    it('reports not_configured when the config file does not exist', () => {
      const result = preflight({ baseDir: REPO, configPath: MISSING_CONFIG, deps: createMockDeps() });

      assert.equal(result.status, 'not_configured');
      assert.match(result.message, /commit-with-costs/);
    });

    it('refuses to run from inside a linked worktree', () => {
      const deps = createMockDeps({
        git: { isLinkedWorktree: () => true, getMainWorktreePath: () => '/repo' }
      });

      const result = preflight({ baseDir: REPO, configPath: CONFIG, deps });

      assert.equal(result.status, 'in_worktree');
      assert.equal(result.data.main_worktree_path, '/repo');
      assert.match(result.message, /\/repo/);
    });

    it('refuses a config naming a different project than the working directory', () => {
      const deps = createMockDeps({ git: { getRepoRoot: () => '/elsewhere' } });

      const result = preflight({ baseDir: '/elsewhere', configPath: CONFIG, deps });

      assert.equal(result.status, 'session_mismatch');
      assert.equal(result.data.config_session_id, '-repo');
      assert.equal(result.data.cwd_session_id, '-elsewhere');
    });

    it('accepts a session launched in a subdirectory of the repository', () => {
      const deps = createMockDeps({ git: { getRepoRoot: () => '/repo' } });

      const result = preflight({ baseDir: '/repo/packages/app', configPath: CONFIG, deps });

      assert.equal(result.status, 'success', 'the repo-root encoding still matches the config');
      assert.equal(result.data.repo_session_id, '-repo');
    });

    it('reports whether rerere will replay recorded resolutions', () => {
      const deps = createMockDeps({ git: { getConfigValue: () => 'true' } });

      const result = preflight({ baseDir: REPO, configPath: CONFIG, deps });

      assert.equal(result.status, 'success');
      assert.equal(result.data.rerere_enabled, true);
    });

    it('errors outside a git repository', () => {
      const deps = createMockDeps({ git: { getRepoRoot: () => null } });
      assert.equal(preflight({ configPath: CONFIG, deps }).status, 'error');
    });

    it('warns about worktree sessions active since the last cost commit, without refusing', () => {
      const deps = createMockDeps({
        git: { getLastCostCommitDate: () => '2026-01-03T00:00:00Z' },
        ccusage: {
          listWorktreeSessions: () => [
            { sessionId: '-repo--claude-worktrees-new', lastActivity: '2026-01-04T00:00:00.000Z' },
            { sessionId: '-repo--claude-worktrees-old', lastActivity: '2026-01-02T00:00:00.000Z' }
          ]
        }
      });

      const result = preflight({ baseDir: REPO, configPath: CONFIG, deps });

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.worktree_sessions,
        [{ session_id: '-repo--claude-worktrees-new', last_activity: '2026-01-04T00:00:00.000Z' }]);
    });

    it('warns about every worktree session with transcripts when no commit anchors the project', () => {
      const deps = createMockDeps({
        ccusage: { listWorktreeSessions: () => [{ sessionId: '-repo--claude-worktrees-a', lastActivity: '2020-01-01T00:00:00.000Z' }] }
      });

      const result = preflight({ baseDir: REPO, configPath: CONFIG, deps });

      assert.equal(result.data.worktree_sessions.length, 1);
    });
  });

  describe('discover', () => {
    it('reports no candidates when every branch is already merged', () => {
      const deps = createMockDeps({ git: { ...headIs('main'), listUnmergedBranches: () => [] } });
      const result = discover({ deps });
      assert.equal(result.status, 'no_candidates');
      assert.deepEqual(result.data.candidates, []);
    });

    it('refuses to run while a merge is already staged', () => {
      const deps = createMockDeps({ git: { isMergeInProgress: () => true } });
      const result = discover({ deps });
      assert.equal(result.status, 'merge_in_progress');
    });

    it('errors outside a git repository', () => {
      const deps = createMockDeps({ git: { getRepoRoot: () => null } });
      const result = discover({ deps });
      assert.equal(result.status, 'error');
      assert.match(result.message, /not inside a git repository/i);
    });

    it('resolves a live worktree branch through its checkout path', () => {
      const deps = createMockDeps({
        git: {
          ...headIs('main'),
          listUnmergedBranches: () => ['feature-a'],
          listWorktrees: () => [
            { path: '/repo', branch: 'main', isMain: true, locked: false },
            { path: '/repo/.claude/worktrees/feature-a', branch: 'feature-a', isMain: false, locked: true }
          ],
          countCommitsAhead: () => 4
        },
        ccusage: {
          findWorktreeSessionId: (root, branch, wtPath) => {
            assert.equal(wtPath, '/repo/.claude/worktrees/feature-a');
            return { sessionId: '-repo--claude-worktrees-feature-a', hasData: true, resolvedBy: 'worktree' };
          }
        }
      });

      const result = discover({ deps });
      assert.equal(result.status, 'success');
      const [candidate] = result.data.candidates;
      assert.equal(candidate.branch, 'feature-a');
      assert.equal(candidate.worktree_live, true);
      assert.equal(candidate.worktree_locked, true);
      assert.equal(candidate.resolved_by, 'worktree');
      assert.equal(candidate.commits_ahead, 4);
    });

    it('flags a branch whose own worktree session still holds transcripts', () => {
      const deps = createMockDeps({
        git: {
          ...headIs('main'),
          listUnmergedBranches: () => ['feature-a', 'feature-b'],
          listWorktrees: () => []
        },
        ccusage: {
          findWorktreeSessionId: (root, branch) => branch === 'feature-a'
            ? { sessionId: '-repo--wt-feature-a', hasData: true, resolvedBy: 'branch-name' }
            : { sessionId: null, hasData: false, resolvedBy: 'none' }
        }
      });

      const result = discover({ deps });

      assert.deepEqual(
        result.data.unaccounted_sessions,
        [{ branch: 'feature-a', session_id: '-repo--wt-feature-a' }],
        'only a session with transcripts of its own is cost this merge cannot see'
      );
    });

    it('falls back to branch-name resolution when the worktree is gone', () => {
      const deps = createMockDeps({
        git: { ...headIs('main'), listUnmergedBranches: () => ['feature-b'], listWorktrees: () => [] },
        ccusage: {
          findWorktreeSessionId: (root, branch, wtPath) => {
            assert.equal(wtPath, null);
            return { sessionId: '-repo--claude-worktrees-feature-b', hasData: false, resolvedBy: 'branch-name' };
          }
        }
      });

      const [candidate] = discover({ deps }).data.candidates;
      assert.equal(candidate.worktree_live, false);
      assert.equal(candidate.resolved_by, 'branch-name');
      assert.equal(candidate.worktree_session_has_data, false);
    });

    it('excludes the branch currently checked out', () => {
      const deps = createMockDeps({
        git: { ...headIs('main'), listUnmergedBranches: () => ['main', 'feature-c'], listWorktrees: () => [] }
      });
      const branches = discover({ deps }).data.candidates.map(c => c.branch);
      assert.deepEqual(branches, ['feature-c']);
    });
  });

  describe('merge', () => {
    it('rejects an empty branch list', () => {
      const result = merge({ branches: [], deps: createMockDeps() });
      assert.equal(result.status, 'error');
      assert.match(result.message, /no branches provided/i);
    });

    it('reports a staged merge once MERGE_HEAD exists', () => {
      let mergeHead = false;
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => mergeHead,
          mergeNoCommit: () => { mergeHead = true; return OK; }
        }
      });

      const result = merge({ branches: ['a', 'b'], deps });
      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.branches, ['a', 'b']);
    });

    it('passes every branch to git in one octopus merge', () => {
      let received = null;
      let mergeHead = false;
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => mergeHead,
          mergeNoCommit: (branches) => { received = branches; mergeHead = true; return OK; }
        }
      });

      merge({ branches: ['a', 'b', 'c'], deps });
      assert.deepEqual(received, ['a', 'b', 'c'], 'octopus merge takes all branches at once');
    });

    it('keeps a conflicted merge staged instead of aborting it', () => {
      const { result, aborted } = mergeWithConflicts({
        conflicted: ['src/app.ts'],
        mergeHeadSurvives: true
      });

      assert.equal(result.status, 'merge_conflicts');
      assert.deepEqual(result.data.unresolved, ['src/app.ts']);
      assert.equal(aborted(), false, 'the user needs the conflicted merge to resolve it');
    });

    it('stages what a recorded resolution already settled and asks only for the rest', () => {
      const { result, staged } = mergeWithConflicts({
        conflicted: ['replayed.ts', 'src/app.ts'],
        mergeHeadSurvives: true,
        markerFree: ['replayed.ts']
      });

      assert.equal(result.status, 'merge_conflicts');
      assert.deepEqual(staged, ['replayed.ts']);
      assert.deepEqual(result.data.resolved_by_rerere, ['replayed.ts']);
      assert.deepEqual(result.data.unresolved, ['src/app.ts']);
    });

    it('is ready to commit when recorded resolutions settle every conflict', () => {
      const { result, staged } = mergeWithConflicts({
        conflicted: ['replayed.ts'],
        mergeHeadSurvives: true,
        markerFree: ['replayed.ts']
      });

      assert.equal(result.status, 'success');
      assert.deepEqual(staged, ['replayed.ts']);
      assert.deepEqual(result.data.resolved_by_rerere, ['replayed.ts']);
    });

    it('rolls back a failed octopus merge, and says to retry per branch', () => {
      const { result, aborted, staged } = mergeWithConflicts({
        conflicted: ['shared.txt'],
        mergeHeadSurvives: true,
        markerFree: ['shared.txt'],
        branches: ['a', 'b']
      });

      assert.equal(result.status, 'merge_failed');
      assert.ok(aborted(), 'a half-merged octopus tree carries no markers and cannot be resolved in place');
      assert.deepEqual(staged, [], 'its marker-free files must never be mistaken for resolutions');
      assert.match(result.message, /one branch at a time/i);
    });

    it('rolls back a single-branch failure that left no MERGE_HEAD', () => {
      const { result, aborted } = mergeWithConflicts({ conflicted: [], mergeHeadSurvives: false });

      assert.equal(result.status, 'merge_failed');
      assert.ok(aborted(), 'the working tree must be left clean');
    });

    it('credits a path git settled and staged from a recorded resolution', () => {
      const { result } = mergeWithConflicts({
        conflicted: [],
        mergeHeadSurvives: true,
        gitOutput: "Auto-merging shared.txt\nStaged 'shared.txt' using previous resolution.\n"
      });

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.resolved_by_rerere, ['shared.txt']);
    });

    it('reports nothing_to_merge when no MERGE_HEAD is produced', () => {
      const deps = createMockDeps({
        git: { isMergeInProgress: () => false, mergeNoCommit: () => OK }
      });
      assert.equal(merge({ branches: ['a'], deps }).status, 'nothing_to_merge');
    });

    it('refuses to start on top of an in-progress merge', () => {
      const deps = createMockDeps({ git: { isMergeInProgress: () => true } });
      assert.equal(merge({ branches: ['a'], deps }).status, 'merge_in_progress');
    });
  });

  describe('resolveStatus', () => {
    it('reports nothing to do without a staged merge', () => {
      const deps = createMockDeps({ git: { isMergeInProgress: () => false } });
      assert.equal(resolveStatus({ deps }).status, 'no_merge_in_progress');
    });

    it('separates paths ready to stage from paths still holding markers', () => {
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => true,
          listConflictedPaths: () => ['done.ts', 'todo.ts'],
          isMarkerFree: (absPath) => absPath.endsWith('done.ts')
        }
      });

      const result = resolveStatus({ deps });

      assert.deepEqual(result.data.ready_to_stage, ['done.ts']);
      assert.deepEqual(result.data.unresolved, ['todo.ts']);
    });
  });

  describe('stageResolved', () => {
    it('refuses to stage anything while a requested path still holds markers', () => {
      let staged = false;
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => true,
          listConflictedPaths: () => ['done.ts', 'todo.ts'],
          isMarkerFree: (absPath) => absPath.endsWith('done.ts'),
          stagePaths: () => { staged = true; return OK; }
        }
      });

      const result = stageResolved({ paths: ['done.ts', 'todo.ts'], deps });

      assert.equal(result.status, 'markers_present');
      assert.deepEqual(result.data.unresolved, ['todo.ts']);
      assert.equal(staged, false, 'a half-staged merge is worse than a refusal');
    });

    it('stages every marker-free path when none is named', () => {
      let remaining = ['done.ts'];
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => true,
          listConflictedPaths: () => remaining,
          isMarkerFree: () => true,
          stagePaths: (paths) => { remaining = remaining.filter(p => !paths.includes(p)); return OK; }
        }
      });

      const result = stageResolved({ deps });

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.staged, ['done.ts']);
      assert.deepEqual(result.data.remaining, []);
    });

    it('reports the paths still unmerged after staging', () => {
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => true,
          listConflictedPaths: () => ['done.ts', 'todo.ts'],
          isMarkerFree: (absPath) => absPath.endsWith('done.ts'),
          stagePaths: () => OK
        }
      });

      const result = stageResolved({ paths: ['done.ts'], deps });

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.remaining, ['done.ts', 'todo.ts']);
    });

    it('reports nothing to stage when no conflict is resolved yet', () => {
      const deps = createMockDeps({
        git: { isMergeInProgress: () => true, listConflictedPaths: () => ['todo.ts'] }
      });
      assert.equal(stageResolved({ deps }).status, 'nothing_to_stage');
    });

    it('reports nothing to do without a staged merge', () => {
      const deps = createMockDeps({ git: { isMergeInProgress: () => false } });
      assert.equal(stageResolved({ deps }).status, 'no_merge_in_progress');
    });
  });

  describe('abort', () => {
    it('reports failure when git cannot abort', () => {
      const deps = createMockDeps({ git: { mergeAbort: () => FAIL } });
      assert.equal(abort({ deps }).status, 'error');
    });
  });

  describe('prepareMerge', () => {
    const withConfig = (overrides = {}) => createMockDeps({
      git: { getRepoRoot: () => REPO, getLastCostCommitDate: () => '2026-01-01T00:00:00Z', ...(overrides.git || {}) },
      ccusage: overrides.ccusage || {},
      cost: overrides.cost || {}
    });

    const WT = '-repo--claude-worktrees-014-x';
    const EARLY = '2026-01-02T00:00:00Z';
    const LATE = '2026-01-05T00:00:00Z';
    const LATER = '2026-01-08T00:00:00Z';

    /**
     * Deps that anchor each session at the given date and record the anchor lookups and the
     * windows handed to computePooledCosts.
     */
    function pooledDeps({ anchors = {}, hasData = () => true, droppedCosts = [] } = {}) {
      const lookups = [];
      const windows = [];
      const measured = [];
      const deps = withConfig({
        git: {
          getLastCostCommitDate: (id, options) => {
            lookups.push({ id, revs: options.revs });
            return anchors[id] ?? null;
          }
        },
        ccusage: { hasSessionData: hasData },
        cost: {
          computePooledCosts: async (w) => {
            // The merge cost always leads with the project window; anything else is the floor measurement
            if (w[0].sessionId !== '-repo') {
              measured.push(...w);
              return { success: true, method: 'inc', since: w[0].since, costs: droppedCosts };
            }
            windows.push(...w);
            return { success: true, method: 'inc', since: w[0].since, costs: [{ model: 'm', cost: 1, in: 1, out: 1 }] };
          }
        }
      });
      return { deps, lookups, windows, measured };
    }

    it('counts the project session since its own last cost-trailered commit', async () => {
      const { deps, lookups, windows } = pooledDeps({ anchors: { '-repo': EARLY } });

      const result = await prepareMerge({ configPath: CONFIG, deps });

      assert.equal(result.status, 'success');
      assert.deepEqual(windows, [{ sessionId: '-repo', since: EARLY }], 'no flag → single project window');
      assert.deepEqual(lookups, [{ id: '-repo', revs: ['HEAD'] }]);
      assert.deepEqual(result.data.included_sessions, []);
      assert.equal(result.data.since, EARLY);
      assert.equal(result.data.anchored, true);
      assert.equal(result.data.method, 'merge');
    });

    it('floors an included session at the project anchor when its own anchor is older', async () => {
      const { deps, windows } = pooledDeps({ anchors: { '-repo': LATE, [WT]: EARLY } });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], branches: ['feature'], deps });

      assert.equal(result.status, 'success');
      assert.deepEqual(windows, [{ sessionId: '-repo', since: LATE }, { sessionId: WT, since: LATE }]);
      assert.deepEqual(result.data.included_sessions, [{ session_id: WT, since: LATE }]);
    });

    it('reports the cost the floor drops from an included session', async () => {
      const dropped = [{ model: 'm', cost: 7, in: 1, out: 1 }];
      const { deps, windows, measured } = pooledDeps({ anchors: { '-repo': LATE, [WT]: EARLY }, droppedCosts: dropped });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], deps });

      assert.deepEqual(measured, [{ sessionId: WT, since: EARLY, until: LATE }]);
      assert.deepEqual(windows[1], { sessionId: WT, since: LATE }, 'the merge cost still uses the floor');
      assert.deepEqual(result.data.included_sessions,
        [{ session_id: WT, since: LATE, excluded: { since: EARLY, until: LATE, cost: dropped } }]);
    });

    it('measures an unanchored included session from its start up to the project anchor', async () => {
      const { deps, measured } = pooledDeps({ anchors: { '-repo': LATE } });

      await prepareMerge({ configPath: CONFIG, includeSessions: [WT], deps });

      assert.deepEqual(measured, [{ sessionId: WT, since: null, until: LATE }]);
    });

    it('opens a no-floor session at its own anchor and measures nothing', async () => {
      const { deps, windows, measured } = pooledDeps({ anchors: { '-repo': LATE, [WT]: EARLY } });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], noFloor: [WT], deps });

      assert.deepEqual(windows[1], { sessionId: WT, since: EARLY });
      assert.deepEqual(measured, []);
      assert.deepEqual(result.data.included_sessions, [{ session_id: WT, since: EARLY }]);
    });

    it('propagates a failure measuring the dropped cost', async () => {
      const deps = withConfig({
        git: { getLastCostCommitDate: (id) => (id === '-repo' ? LATE : null) },
        ccusage: { hasSessionData: () => true },
        cost: { computePooledCosts: async () => ({ success: false, error: 'boom' }) }
      });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], deps });

      assert.equal(result.status, 'error');
      assert.equal(result.message, 'boom');
    });

    it('starts an included session at its own anchor when that is newer than the project anchor', async () => {
      const { deps, lookups, windows } = pooledDeps({ anchors: { '-repo': EARLY, [WT]: LATE } });

      await prepareMerge({ configPath: CONFIG, includeSessions: [WT], branches: ['feature'], deps });

      assert.deepEqual(windows, [{ sessionId: '-repo', since: EARLY }, { sessionId: WT, since: LATE }]);
      assert.deepEqual(lookups, [{ id: '-repo', revs: ['HEAD'] }, { id: WT, revs: ['HEAD', 'feature'] }],
        'the included session is also anchored on the branches being merged');
    });

    it('counts an included session whole when neither it nor the project is anchored', async () => {
      const { deps, windows } = pooledDeps();

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], deps });

      assert.equal(result.status, 'no_anchor');
      assert.deepEqual(windows, [{ sessionId: '-repo', since: null }, { sessionId: WT, since: null }]);
    });

    describe('with --since/--until', () => {
      it('caps the project window at until', async () => {
        const { deps, windows } = pooledDeps({ anchors: { '-repo': EARLY } });

        const result = await prepareMerge({ configPath: CONFIG, until: LATE, deps });

        assert.equal(result.status, 'success');
        assert.deepEqual(windows, [{ sessionId: '-repo', since: EARLY, until: LATE }]);
        assert.equal(result.data.since, EARLY);
        assert.equal(result.data.until, LATE);
      });

      it('opens the project window at since instead of looking up the anchor', async () => {
        const { deps, lookups, windows } = pooledDeps({ anchors: { '-repo': LATER } });

        const result = await prepareMerge({ configPath: CONFIG, since: EARLY, until: LATE, deps });

        assert.equal(result.status, 'success');
        assert.deepEqual(windows, [{ sessionId: '-repo', since: EARLY, until: LATE }]);
        assert.deepEqual(lookups, [], 'the anchor a re-measured merge wrote is never consulted');
        assert.equal(result.data.anchored, true);
      });

      it('floors an included session at the overriding since and caps it at until', async () => {
        const { deps, windows, measured } = pooledDeps({ anchors: { [WT]: EARLY } });

        const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], since: LATE, until: LATER, deps });

        assert.deepEqual(windows, [
          { sessionId: '-repo', since: LATE, until: LATER },
          { sessionId: WT, since: LATE, until: LATER }
        ]);
        assert.deepEqual(measured, [{ sessionId: WT, since: EARLY, until: LATE }], 'the floor still measures what it drops');
        assert.equal(result.data.included_sessions[0].since, LATE);
      });

      it('caps a no-floor session at until while opening it at its own anchor', async () => {
        const { deps, windows } = pooledDeps({ anchors: { [WT]: EARLY } });

        await prepareMerge({ configPath: CONFIG, includeSessions: [WT], noFloor: [WT], since: LATE, until: LATER, deps });

        assert.deepEqual(windows[1], { sessionId: WT, since: EARLY, until: LATER });
      });

      it('disregards an included session anchor at or after until', async () => {
        const { deps, windows, measured } = pooledDeps({ anchors: { [WT]: LATER } });

        await prepareMerge({ configPath: CONFIG, includeSessions: [WT], since: EARLY, until: LATER, deps });

        assert.deepEqual(windows[1], { sessionId: WT, since: EARLY, until: LATER },
          'the re-measured merge\'s own trailer must not empty the window');
        assert.deepEqual(measured, [{ sessionId: WT, since: null, until: EARLY }]);
      });

      for (const [label, range] of [
        ['equal to since', { since: LATE, until: LATE }],
        ['earlier than since', { since: LATE, until: EARLY }],
        ['earlier than the project anchor', { until: EARLY }]
      ]) {
        it(`rejects until ${label}`, async () => {
          const { deps, windows } = pooledDeps({ anchors: { '-repo': LATE } });

          const result = await prepareMerge({ configPath: CONFIG, ...range, deps });

          assert.equal(result.status, 'invalid_range');
          assert.deepEqual(windows, [], 'no cost is computed');
        });
      }

      it('rejects a date that does not parse', async () => {
        const { deps, windows } = pooledDeps({ anchors: { '-repo': EARLY } });

        const result = await prepareMerge({ configPath: CONFIG, until: 'yesterday', deps });

        assert.equal(result.status, 'invalid_range');
        assert.match(result.message, /yesterday/);
        assert.deepEqual(windows, []);
      });
    });

    it('rejects an included session that does not belong to this repository', async () => {
      const { deps, windows } = pooledDeps({ anchors: { '-repo': EARLY } });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: ['-repository-other'], deps });

      assert.equal(result.status, 'invalid_session');
      assert.equal(result.data.session_id, '-repository-other');
      assert.deepEqual(windows, [], 'no cost is computed');
    });

    it('rejects an included session with no recorded data', async () => {
      const { deps } = pooledDeps({ anchors: { '-repo': EARLY }, hasData: (id) => id !== WT });

      const result = await prepareMerge({ configPath: CONFIG, includeSessions: [WT], deps });

      assert.equal(result.status, 'invalid_session');
      assert.equal(result.data.session_id, WT);
    });

    it('reports an error rather than no_anchor when the anchor lookup fails', async () => {
      const deps = withConfig({
        git: { getLastCostCommitDate: () => { throw new Error('git log failed while looking for the cost anchor: boom'); } }
      });

      const result = await prepareMerge({ configPath: CONFIG, deps });

      assert.equal(result.status, 'error');
      assert.match(result.message, /git log failed/);
    });

    it('withholds a whole-session figure for confirmation when no commit anchors it', async () => {
      const deps = withConfig({ git: { getLastCostCommitDate: () => null } });

      const result = await prepareMerge({ configPath: CONFIG, deps });

      assert.equal(result.status, 'no_anchor');
      assert.equal(result.data.anchored, false);
      assert.equal(result.data.since, null);
      assert.ok(result.data.current_cost.length > 0, 'the figure is returned so the user can judge it');
    });

    it('rejects cost metrics that fail validation', async () => {
      const deps = withConfig({
        ccusage: { validateCostMetrics: () => false },
        cost: { computePooledCosts: async () => ({ success: true, method: 'inc', since: null, costs: [] }) }
      });

      assert.equal((await prepareMerge({ configPath: CONFIG, deps })).status, 'invalid_costs');
    });

    it('propagates a cost computation failure', async () => {
      const deps = withConfig({
        cost: { computePooledCosts: async () => ({ success: false, costs: [], error: 'ccusage exploded' }) }
      });

      const result = await prepareMerge({ configPath: CONFIG, deps });
      assert.equal(result.status, 'error');
      assert.equal(result.message, 'ccusage exploded');
    });

    it('errors when the config cannot be read', async () => {
      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/does-not-exist.json',
        deps: withConfig()
      });
      assert.equal(result.status, 'error');
      assert.match(result.message, /does-not-exist\.json/);
    });
  });
});
