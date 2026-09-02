import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  setupGitRepo,
  execGit,
  commitOnBranch,
  execMergeWorkflow,
  writeSessionConfig,
  setupConflict,
  writeResolution,
  addWorktree
} from './helpers.js';
import { pwdToSessionId } from '../../../plugins/dev-workflow/lib/ccusage-operations.js';

describe('merge-with-costs/merge-workflow.js (integration)', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
    setupGitRepo(testEnv);
  });

  afterEach(() => teardownTestEnv(testEnv));

  const CONFIG = ['--config', '.claude/settings.plugins.commit-with-costs.json'];
  const git = (...args) => execGit(args, { cwd: testEnv.tmpDir });
  const headSubject = () => git('log', '-1', '--format=%s').stdout.trim();
  const parentCount = () => git('rev-list', '--parents', '-n', '1', 'HEAD').stdout.trim().split(/\s+/).length - 1;
  const mergeStaged = () => git('rev-parse', '--verify', '--quiet', 'MERGE_HEAD').exitCode === 0;
  const repoSessionId = () => pwdToSessionId(git('rev-parse', '--show-toplevel').stdout.trim());

  describe('preflight', () => {
    it('accepts a run from the main working tree whose config names this project', () => {
      writeSessionConfig(testEnv, repoSessionId());

      const { json } = execMergeWorkflow(testEnv, 'preflight', { args: CONFIG });

      assert.equal(json.status, 'success');
      assert.equal(json.data.in_linked_worktree, false);
    });

    it('refuses a run from inside a linked worktree', () => {
      writeSessionConfig(testEnv, repoSessionId());
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      const worktreePath = addWorktree(testEnv, 'feature-a');
      writeSessionConfig(testEnv, repoSessionId());

      const { json } = execMergeWorkflow(testEnv, 'preflight', {
        args: ['--config', join(testEnv.tmpDir, '.claude', 'settings.plugins.commit-with-costs.json')],
        cwd: worktreePath
      });

      assert.equal(json.status, 'in_worktree');
      assert.match(json.message, /main working tree/);
    });

    it('refuses a config naming a different project', () => {
      writeSessionConfig(testEnv, '-some-other-project');

      const { json } = execMergeWorkflow(testEnv, 'preflight', { args: CONFIG });

      assert.equal(json.status, 'session_mismatch');
      assert.equal(json.data.config_session_id, '-some-other-project');
    });

    it('reports the repository rerere setting', () => {
      writeSessionConfig(testEnv, repoSessionId());
      git('config', 'rerere.enabled', 'true');

      const { json } = execMergeWorkflow(testEnv, 'preflight', { args: CONFIG });

      assert.equal(json.data.rerere_enabled, true);
    });
  });

  describe('discover', () => {
    it('finds a branch holding unmerged commits', () => {
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');

      const { json } = execMergeWorkflow(testEnv, 'discover');

      assert.equal(json.status, 'success');
      assert.equal(json.data.current_branch, 'main');
      const [candidate] = json.data.candidates;
      assert.equal(candidate.branch, 'feature-a');
      assert.equal(candidate.commits_ahead, 1);
      assert.equal(candidate.worktree_live, false, 'branch has no worktree in this repo');
      assert.deepEqual(json.data.unaccounted_sessions, [], 'no worktree session holds transcripts here');
    });

    it('reports no candidates in a repository with only the current branch', () => {
      const { json } = execMergeWorkflow(testEnv, 'discover');
      assert.equal(json.status, 'no_candidates');
    });
  });

  describe('merge', () => {
    it('stages an octopus merge of several branches without committing', () => {
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      commitOnBranch(testEnv, 'feature-b', 'b.txt', 'b');

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a,feature-b'] });

      assert.equal(json.status, 'success');
      assert.equal(headSubject(), 'initial commit', 'nothing is committed yet');
      assert.ok(mergeStaged(), 'MERGE_HEAD is left for the commit step');
    });

    it('rolls back an octopus merge that hits a conflict', () => {
      commitOnBranch(testEnv, 'feature-a', 'shared.txt', 'from a');
      commitOnBranch(testEnv, 'feature-b', 'shared.txt', 'from b');

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a,feature-b'] });

      assert.equal(json.status, 'merge_failed');
      assert.equal(mergeStaged(), false, 'the failed merge is rolled back');
      assert.equal(git('status', '--porcelain').stdout.trim(), '');
      assert.match(json.message, /one branch at a time/i);
    });

    it('keeps a conflicted single-branch merge staged for resolution', () => {
      const file = setupConflict(testEnv);

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      assert.equal(json.status, 'merge_conflicts');
      assert.deepEqual(json.data.unresolved, [file]);
      assert.ok(mergeStaged(), 'the conflicted merge survives so it can be resolved');
      assert.match(readFileSync(join(testEnv.tmpDir, file), 'utf-8'), /^<{7} /m);
    });

    it('accepts a branch name containing shell metacharacters', () => {
      commitOnBranch(testEnv, 'feature/a;b', 'a.txt', 'a');

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature/a;b'] });

      assert.equal(json.status, 'success');
    });
  });

  describe('resolving conflicts', () => {
    const COSTS = '[{"model":"claude-opus-5","cost":12.5,"in":100,"out":200,"cacheWrites":"5k","cacheReads":"90k"}]';

    it('commits the merge once the conflict is resolved and staged', () => {
      writeSessionConfig(testEnv, '-test-session');
      const file = setupConflict(testEnv);
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      writeResolution(testEnv, file, 'from main and from feature');
      const staged = execMergeWorkflow(testEnv, 'stage-resolved', { args: ['--paths', file] });
      assert.equal(staged.json.status, 'success');
      assert.deepEqual(staged.json.data.remaining, []);

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS, '--since', '2026-01-01T00:00:00Z'],
        input: 'Merge feature-a\n\n- Resolve shared.txt by keeping both edits'
      });

      assert.equal(json.status, 'success');
      assert.equal(headSubject(), 'Merge feature-a');
      assert.equal(parentCount(), 2);
    });

    it('refuses to stage a path that still holds conflict markers', () => {
      const file = setupConflict(testEnv);
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'stage-resolved', { args: ['--paths', file] });

      assert.equal(json.status, 'markers_present');
      assert.deepEqual(json.data.unresolved, [file]);
      assert.equal(git('diff', '--name-only', '--diff-filter=U').stdout.trim(), file, 'nothing was staged');
    });

    it('reports which paths are ready to stage', () => {
      const file = setupConflict(testEnv);
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const before = execMergeWorkflow(testEnv, 'resolve-status');
      assert.deepEqual(before.json.data.unresolved, [file]);
      assert.deepEqual(before.json.data.ready_to_stage, []);

      writeResolution(testEnv, file, 'resolved');
      const after = execMergeWorkflow(testEnv, 'resolve-status');
      assert.deepEqual(after.json.data.ready_to_stage, [file]);
      assert.deepEqual(after.json.data.unresolved, []);
    });

    it('refuses to commit while a path is still unmerged', () => {
      writeSessionConfig(testEnv, '-test-session');
      setupConflict(testEnv);
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS],
        input: 'Merge feature-a'
      });

      assert.equal(json.status, 'conflicts_unresolved');
      assert.ok(mergeStaged(), 'the merge is left in progress');
    });

    it('replays a recorded resolution instead of asking again', () => {
      writeSessionConfig(testEnv, '-test-session');
      git('config', 'rerere.enabled', 'true');
      const file = setupConflict(testEnv);

      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });
      writeResolution(testEnv, file, 'from main and from feature');
      execMergeWorkflow(testEnv, 'stage-resolved', { args: ['--paths', file] });
      execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS, '--since', '2026-01-01T00:00:00Z'],
        input: 'Merge feature-a'
      });

      git('reset', '--hard', 'HEAD~1');
      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      assert.equal(json.status, 'success', 'the recorded resolution settles every conflict');
      assert.deepEqual(json.data.resolved_by_rerere, [file], 'the replay is reported, not passed off as a clean merge');
      assert.equal(readFileSync(join(testEnv.tmpDir, file), 'utf-8'), 'from main and from feature');
      assert.equal(git('diff', '--name-only', '--diff-filter=U').stdout.trim(), '', 'the replayed file is staged');
    });
  });

  describe('abort', () => {
    it('clears a staged merge', () => {
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'abort');

      assert.equal(json.status, 'success');
      assert.equal(mergeStaged(), false);
    });

    it('clears a conflicted merge', () => {
      setupConflict(testEnv);
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      execMergeWorkflow(testEnv, 'abort');

      assert.equal(mergeStaged(), false);
      assert.equal(git('status', '--porcelain').stdout.trim(), '');
    });
  });

  describe('commit', () => {
    const COSTS = '[{"model":"claude-opus-5","cost":12.5,"in":100,"out":200,"cacheWrites":"5k","cacheReads":"90k"}]';

    it('records the merge with every parent and a merge cost trailer', () => {
      writeSessionConfig(testEnv, '-test-session');
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      commitOnBranch(testEnv, 'feature-b', 'b.txt', 'b');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a,feature-b'] });

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS, '--since', '2026-01-01T00:00:00Z'],
        input: 'Merge 2 sub-agent branches\n\n- Integrate feature-a and feature-b'
      });

      assert.equal(json.status, 'success');
      assert.equal(headSubject(), 'Merge 2 sub-agent branches');
      assert.equal(parentCount(), 3, 'octopus merge keeps main plus both branches as parents');

      const body = git('log', '-1', '--format=%B').stdout;
      assert.match(body, /Co-Authored-By: Claude Code <noreply@anthropic\.com>/);

      const trailer = body.split('\n').find(l => l.startsWith('Claude-Cost-Metrics: '));
      const parsed = JSON.parse(trailer.replace('Claude-Cost-Metrics: ', ''));
      assert.equal(parsed.method, 'merge');
      assert.equal(parsed.sessionId, '-test-session');
      assert.equal(parsed.since, '2026-01-01T00:00:00Z');
      assert.equal(parsed.cost[0].cost, 12.5);
    });

    it('refuses to commit when no merge is staged', () => {
      writeSessionConfig(testEnv, '-test-session');

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS],
        input: 'Merge nothing'
      });

      assert.equal(json.status, 'no_merge_in_progress');
    });

    it('leaves the merge staged when cost metrics are invalid', () => {
      writeSessionConfig(testEnv, '-test-session');
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', '[]'],
        input: 'Merge feature-a'
      });

      assert.equal(json.status, 'metrics_invalid');
      assert.ok(mergeStaged(), 'the merge survives so the user can retry or abort');
    });

    it('writes a trailer that commit-with-costs can anchor against', () => {
      writeSessionConfig(testEnv, '-test-session');
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });
      execMergeWorkflow(testEnv, 'commit', {
        args: [...CONFIG, '--costs', COSTS],
        input: 'Merge feature-a'
      });

      writeFileSync(join(testEnv.tmpDir, 'later.txt'), 'later');
      git('add', 'later.txt');
      git('commit', '-m', 'later work');

      const anchorTest = execMergeWorkflow(testEnv, 'discover');
      assert.equal(anchorTest.json.status, 'no_candidates', 'the branch is merged, so it is no longer a candidate');
    });
  });
});
