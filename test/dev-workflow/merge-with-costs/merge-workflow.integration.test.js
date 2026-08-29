import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupTestEnv,
  teardownTestEnv,
  setupGitRepo,
  execGit,
  commitOnBranch,
  execMergeWorkflow,
  writeSessionConfig
} from './helpers.js';

describe('merge-with-costs/merge-workflow.js (integration)', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
    setupGitRepo(testEnv);
  });

  afterEach(() => teardownTestEnv(testEnv));

  const headSubject = () => execGit(['log', '-1', '--format=%s'], { cwd: testEnv.tmpDir }).stdout.trim();
  const parentCount = () => execGit(['rev-list', '--parents', '-n', '1', 'HEAD'], { cwd: testEnv.tmpDir })
    .stdout.trim().split(/\s+/).length - 1;

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
      assert.equal(
        execGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'], { cwd: testEnv.tmpDir }).exitCode,
        0,
        'MERGE_HEAD is left for the commit step'
      );
    });

    it('aborts and leaves a clean tree when branches conflict', () => {
      commitOnBranch(testEnv, 'feature-a', 'shared.txt', 'from a');
      commitOnBranch(testEnv, 'feature-b', 'shared.txt', 'from b');

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a,feature-b'] });

      assert.equal(json.status, 'merge_failed');
      assert.equal(
        execGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'], { cwd: testEnv.tmpDir }).exitCode,
        1,
        'the failed merge is rolled back'
      );
      assert.equal(execGit(['status', '--porcelain'], { cwd: testEnv.tmpDir }).stdout.trim(), '');
    });

    it('accepts a branch name containing shell metacharacters', () => {
      commitOnBranch(testEnv, 'feature/a;b', 'a.txt', 'a');

      const { json } = execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature/a;b'] });

      assert.equal(json.status, 'success');
    });
  });

  describe('abort', () => {
    it('clears a staged merge', () => {
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'abort');

      assert.equal(json.status, 'success');
      assert.equal(
        execGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'], { cwd: testEnv.tmpDir }).exitCode,
        1
      );
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
        args: ['--config', '.claude/settings.plugins.commit-with-costs.json', '--costs', COSTS, '--since', '2026-01-01T00:00:00Z'],
        input: 'Merge 2 sub-agent branches\n\n- Integrate feature-a and feature-b'
      });

      assert.equal(json.status, 'success');
      assert.equal(headSubject(), 'Merge 2 sub-agent branches');
      assert.equal(parentCount(), 3, 'octopus merge keeps main plus both branches as parents');

      const body = execGit(['log', '-1', '--format=%B'], { cwd: testEnv.tmpDir }).stdout;
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
        args: ['--config', '.claude/settings.plugins.commit-with-costs.json', '--costs', COSTS],
        input: 'Merge nothing'
      });

      assert.equal(json.status, 'no_merge_in_progress');
    });

    it('leaves the merge staged when cost metrics are invalid', () => {
      writeSessionConfig(testEnv, '-test-session');
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });

      const { json } = execMergeWorkflow(testEnv, 'commit', {
        args: ['--config', '.claude/settings.plugins.commit-with-costs.json', '--costs', '[]'],
        input: 'Merge feature-a'
      });

      assert.equal(json.status, 'metrics_invalid');
      assert.equal(
        execGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'], { cwd: testEnv.tmpDir }).exitCode,
        0,
        'the merge survives so the user can retry or abort'
      );
    });

    it('writes a trailer that commit-with-costs can anchor against', () => {
      writeSessionConfig(testEnv, '-test-session');
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      execMergeWorkflow(testEnv, 'merge', { args: ['--branches', 'feature-a'] });
      execMergeWorkflow(testEnv, 'commit', {
        args: ['--config', '.claude/settings.plugins.commit-with-costs.json', '--costs', COSTS],
        input: 'Merge feature-a'
      });

      writeFileSync(join(testEnv.tmpDir, 'later.txt'), 'later');
      execGit(['add', 'later.txt'], { cwd: testEnv.tmpDir });
      execGit(['commit', '-m', 'later work'], { cwd: testEnv.tmpDir });

      const anchorTest = execMergeWorkflow(testEnv, 'discover');
      assert.equal(anchorTest.json.status, 'no_candidates', 'the branch is merged, so it is no longer a candidate');
    });
  });
});
