import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { discover, merge, abort, prepareMerge } from '../../../plugins/dev-workflow/skills/merge-with-costs/scripts/merge-workflow.js';
import { createMockDeps } from './helpers.js';

const OK = { stdout: '', stderr: '', exitCode: 0 };
const FAIL = { stdout: '', stderr: 'conflict', exitCode: 1 };

const headIs = (branch) => ({ execGit: () => ({ ...OK, stdout: `${branch}\n` }) });

describe('merge-with-costs/merge-workflow.js', () => {
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
      assert.equal(candidate.has_cost_data, false, 'removed worktree has no recoverable cost data');
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

    it('aborts and surfaces conflicting paths when the merge fails', () => {
      let aborted = false;
      const deps = createMockDeps({
        git: {
          isMergeInProgress: () => false,
          mergeNoCommit: () => FAIL,
          listConflictedPaths: () => ['src/app.ts'],
          mergeAbort: () => { aborted = true; return OK; }
        }
      });

      const result = merge({ branches: ['a'], deps });
      assert.equal(result.status, 'merge_failed');
      assert.deepEqual(result.data.conflicts, ['src/app.ts']);
      assert.ok(aborted, 'working tree must be left clean');
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

  describe('abort', () => {
    it('reports failure when git cannot abort', () => {
      const deps = createMockDeps({ git: { mergeAbort: () => FAIL } });
      assert.equal(abort({ deps }).status, 'error');
    });
  });

  describe('prepareMerge', () => {
    const withConfig = (overrides = {}) => createMockDeps({
      git: { getRepoRoot: () => '/repo', getLastCostCommitDate: () => '2026-01-01T00:00:00Z', ...(overrides.git || {}) },
      ccusage: overrides.ccusage || {},
      cost: overrides.cost || {}
    });

    it('counts a worktree session in full and the orchestrator incrementally', async () => {
      let captured = null;
      const deps = withConfig({
        ccusage: {
          findWorktreeSessionId: () => ({ sessionId: '-repo--wt-feature-a', hasData: true, resolvedBy: 'branch-name' })
        },
        cost: {
          computeMergedCosts: async (sources) => {
            captured = sources;
            return { success: true, method: 'merge', costs: [{ model: 'm', cost: 1, in: 1, out: 1 }], contributions: [] };
          }
        }
      });

      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/session-config.json',
        branches: ['feature-a'],
        deps
      });

      assert.equal(result.status, 'success');
      assert.equal(captured.length, 2);
      assert.equal(captured[0].since, null, 'worktree session has no anchor, so all of it counts');
      assert.equal(captured[1].label, 'orchestrator');
      assert.equal(captured[1].since, '2026-01-01T00:00:00Z', 'orchestrator counts only since its last cost commit');
    });

    it('lists branches whose transcripts are gone instead of counting them as zero', async () => {
      const deps = withConfig({
        ccusage: {
          findWorktreeSessionId: (root, branch) => branch === 'gone'
            ? { sessionId: '-repo--wt-gone', hasData: false, resolvedBy: 'branch-name' }
            : { sessionId: '-repo--wt-live', hasData: true, resolvedBy: 'branch-name' }
        }
      });

      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/session-config.json',
        branches: ['gone', 'live'],
        deps
      });

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.unresolved, [{ branch: 'gone', session_id: '-repo--wt-gone', reason: 'no_cost_data' }]);
    });

    it('marks a branch with no matching project directory as unresolved', async () => {
      const deps = withConfig();
      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/session-config.json',
        branches: ['ghost'],
        deps
      });
      assert.equal(result.data.unresolved[0].reason, 'no_session');
    });

    it('rejects cost metrics that fail validation', async () => {
      const deps = withConfig({
        ccusage: { validateCostMetrics: () => false },
        cost: { computeMergedCosts: async () => ({ success: true, method: 'merge', costs: [], contributions: [] }) }
      });

      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/session-config.json',
        branches: [],
        deps
      });
      assert.equal(result.status, 'invalid_costs');
    });

    it('propagates a cost computation failure', async () => {
      const deps = withConfig({
        cost: { computeMergedCosts: async () => ({ success: false, costs: [], contributions: [], error: 'ccusage exploded' }) }
      });

      const result = await prepareMerge({
        configPath: 'test/dev-workflow/merge-with-costs/fixtures/session-config.json',
        branches: [],
        deps
      });
      assert.equal(result.status, 'error');
      assert.equal(result.message, 'ccusage exploded');
    });
  });
});
