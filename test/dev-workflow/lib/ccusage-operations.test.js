import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';

import {
  pwdToSessionId,
  isProjectDirName,
  validateCostMetrics,
  filterZeroUsageCosts,
  listLocalSessions,
  findRecommendedSession,
  getCleanupPeriodDays,
  hasSessionData,
  findWorktreeSessionId
} from '../../../plugins/dev-workflow/lib/ccusage-operations.js';

describe('lib: ccusage-operations.js', () => {
  describe('pwdToSessionId', () => {
    it('converts absolute path to session ID format', () => {
      const result = pwdToSessionId('/Users/noahlz/projects/claude-plugins');
      assert.equal(result, '-Users-noahlz-projects-claude-plugins');
    });

    it('converts path without leading slash', () => {
      const result = pwdToSessionId('Users/noahlz/projects/test');
      assert.equal(result, '-Users-noahlz-projects-test');
    });

    it('handles paths with trailing slash', () => {
      const result = pwdToSessionId('/Users/noahlz/projects/test/');
      assert.equal(result, '-Users-noahlz-projects-test-');
    });

    it('handles single-level paths', () => {
      const result = pwdToSessionId('/home');
      assert.equal(result, '-home');
    });

    it('handles root path', () => {
      const result = pwdToSessionId('/');
      assert.equal(result, '-');
    });

    it('replaces all forward slashes with dashes', () => {
      const result = pwdToSessionId('/a/b/c/d/e');
      assert.equal(result, '-a-b-c-d-e');
      assert.equal((result.match(/-/g) || []).length, 5);
    });

    it('converts a Windows drive path (backslashes) without a leading dash', () => {
      const result = pwdToSessionId('C:\\Users\\foo\\bar');
      assert.equal(result, 'C--Users-foo-bar');
    });

    it('converts a Windows drive path with forward slashes', () => {
      const result = pwdToSessionId('C:/Users/foo');
      assert.equal(result, 'C--Users-foo');
    });
  });

  describe('isProjectDirName', () => {
    it('accepts Unix path-encoded dirs (leading dash)', () => {
      assert.equal(isProjectDirName('-Users-foo'), true);
    });

    it('accepts Windows drive-letter dirs', () => {
      assert.equal(isProjectDirName('C--Users-foo'), true);
    });

    it('rejects unrelated directory names', () => {
      assert.equal(isProjectDirName('node_modules'), false);
    });
  });

  describe('validateCostMetrics', () => {
    it('validates valid cost metrics array', () => {
      const costs = [
        { model: 'claude-opus-4.5', in: 100, out: 50, cost: 0.12 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only cost value', () => {
      const costs = [
        { model: 'test-model', in: 0, out: 0, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only input tokens', () => {
      const costs = [
        { model: 'test-model', in: 100, out: 0, cost: 0 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('validates costs with only output tokens', () => {
      const costs = [
        { model: 'test-model', in: 0, out: 50, cost: 0 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('rejects empty array', () => {
      assert.equal(validateCostMetrics([]), false);
    });

    it('rejects non-array', () => {
      assert.equal(validateCostMetrics(null), false);
      assert.equal(validateCostMetrics(undefined), false);
      assert.equal(validateCostMetrics({}), false);
    });

    it('rejects cost with missing model field', () => {
      const costs = [
        { in: 100, out: 50, cost: 0.12 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with non-numeric cost field', () => {
      const costs = [
        { model: 'test-model', in: 100, out: 50, cost: 'invalid' }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('rejects cost with all zeros and no cost', () => {
      const costs = [
        { model: 'test-model', in: 0, out: 0, cost: 0 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });

    it('accepts multiple valid costs', () => {
      const costs = [
        { model: 'claude-opus-4.5', in: 100, out: 50, cost: 0.12 },
        { model: 'claude-haiku-4.5', in: 200, out: 75, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), true);
    });

    it('rejects if any element is invalid', () => {
      const costs = [
        { model: 'claude-opus-4.5', in: 100, out: 50, cost: 0.12 },
        { in: 200, out: 75, cost: 0.05 }
      ];
      assert.equal(validateCostMetrics(costs), false);
    });
  });

  describe('filterZeroUsageCosts', () => {
    it('filters out entries with all zeros', () => {
      const costs = [
        { model: 'claude-sonnet-4', in: 100, out: 50, cost: 0.10 },
        { model: 'claude-haiku-3.5', in: 0, out: 0, cost: 0 }
      ];
      const result = filterZeroUsageCosts(costs);
      assert.equal(result.filtered.length, 1);
      assert.equal(result.filtered[0].model, 'claude-sonnet-4');
      assert.equal(result.removed.length, 1);
      assert.equal(result.removed[0].model, 'claude-haiku-3.5');
    });

    it('keeps entries with any non-zero value', () => {
      const costs = [
        { model: 'model-1', in: 100, out: 0, cost: 0 },
        { model: 'model-2', in: 0, out: 50, cost: 0 },
        { model: 'model-3', in: 0, out: 0, cost: 0.05 }
      ];
      const result = filterZeroUsageCosts(costs);
      assert.equal(result.filtered.length, 3);
      assert.equal(result.removed.length, 0);
    });

    it('handles empty array', () => {
      const result = filterZeroUsageCosts([]);
      assert.deepStrictEqual(result.filtered, []);
      assert.deepStrictEqual(result.removed, []);
    });

    it('handles non-array input', () => {
      const result = filterZeroUsageCosts(null);
      assert.deepStrictEqual(result.filtered, []);
      assert.deepStrictEqual(result.removed, []);
    });
  });

  describe('listLocalSessions', () => {
    it('returns object with status and data properties', () => {
      const result = listLocalSessions();
      assert.ok('status' in result);
      assert.ok('data' in result);
      assert.ok(result.status === 'success' || result.status === 'error');
      assert.ok(Array.isArray(result.data.sessions));
    });

    it('returns success with sessions array', () => {
      const result = listLocalSessions();
      assert.equal(result.status, 'success');
      assert.ok(Array.isArray(result.data.sessions));
    });
  });

  describe('findRecommendedSession', () => {
    it('returns object with sessionId and match properties', () => {
      const result = findRecommendedSession('/test/path');
      assert.ok('sessionId' in result);
      assert.ok('match' in result);
      assert.equal(typeof result.match, 'boolean');
      assert.ok(typeof result.sessionId === 'string' || result.sessionId === null);
    });

    it('returns match=false for non-existent project path', () => {
      const result = findRecommendedSession('/nonexistent/path-' + Date.now());
      assert.equal(result.match, false);
      assert.equal(result.sessionId, null);
    });
  });

  // loadBlockData is tested via ccusage integration (wraps a real ccusage import).

  describe('listLocalSessions', () => {
    let testEnv;
    let origHome;

    beforeEach(() => {
      testEnv = setupTestEnv();
      origHome = process.env.HOME;
    });

    afterEach(() => {
      process.env.HOME = origHome;
      teardownTestEnv(testEnv);
    });

    it('returns empty sessions when projects directory does not exist', () => {
      process.env.HOME = testEnv.tmpDir; // no .claude/projects here
      const result = listLocalSessions();
      assert.equal(result.status, 'success');
      assert.deepStrictEqual(result.data.sessions, []);
    });
  });

  describe('getCleanupPeriodDays', () => {
    let testEnv;
    let origHome;
    let origCwd;

    beforeEach(() => {
      testEnv = setupTestEnv();
      origHome = process.env.HOME;
      origCwd = process.cwd();
    });

    afterEach(() => {
      process.env.HOME = origHome;
      process.chdir(origCwd);
      teardownTestEnv(testEnv);
    });

    it('returns default 30 when no settings files exist', () => {
      process.env.HOME = testEnv.tmpDir;
      process.chdir(testEnv.tmpDir);
      assert.equal(getCleanupPeriodDays(), 30);
    });

    it('reads cleanupPeriodDays from global settings file', () => {
      const globalClaudeDir = join(testEnv.tmpDir, '.claude');
      mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(join(globalClaudeDir, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 60 }));
      process.env.HOME = testEnv.tmpDir;
      process.chdir(testEnv.tmpDir);
      assert.equal(getCleanupPeriodDays(), 60);
    });

    it('project settings override global settings', () => {
      // Global settings: 60 days
      const globalClaudeDir = join(testEnv.tmpDir, '.claude');
      mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(join(globalClaudeDir, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 60 }));
      process.env.HOME = testEnv.tmpDir;

      // Project settings: 14 days (already has .claude dir from setupTestEnv)
      writeFileSync(join(testEnv.tmpDir, '.claude', 'settings.json'), JSON.stringify({ cleanupPeriodDays: 14 }));
      process.chdir(testEnv.tmpDir);

      assert.equal(getCleanupPeriodDays(), 14);
    });

    it('ignores non-positive values (returns default 30)', () => {
      const globalClaudeDir = join(testEnv.tmpDir, '.claude');
      mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(join(globalClaudeDir, 'settings.json'), JSON.stringify({ cleanupPeriodDays: -5 }));
      process.env.HOME = testEnv.tmpDir;
      process.chdir(testEnv.tmpDir);
      assert.equal(getCleanupPeriodDays(), 30);
    });

    it('ignores non-numeric values (returns default 30)', () => {
      const globalClaudeDir = join(testEnv.tmpDir, '.claude');
      mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(join(globalClaudeDir, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 'thirty' }));
      process.env.HOME = testEnv.tmpDir;
      process.chdir(testEnv.tmpDir);
      assert.equal(getCleanupPeriodDays(), 30);
    });

    it('ignores malformed JSON files (returns default 30)', () => {
      const globalClaudeDir = join(testEnv.tmpDir, '.claude');
      mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(join(globalClaudeDir, 'settings.json'), '{ not valid json }');
      process.env.HOME = testEnv.tmpDir;
      process.chdir(testEnv.tmpDir);
      assert.equal(getCleanupPeriodDays(), 30);
    });
  });
});

describe('lib/ccusage-operations.js worktree session resolution', () => {
  let projectsDir;
  let originalHome;

  const makeSession = (name, { withData = true } = {}) => {
    const dir = join(projectsDir, name);
    mkdirSync(join(dir, 'uuid', 'subagents'), { recursive: true });
    if (withData) {
      writeFileSync(join(dir, 'uuid', 'subagents', 'agent-a.jsonl'), '{}\n');
    }
  };

  beforeEach(() => {
    originalHome = process.env.HOME;
    const tmpHome = mkdtempSync(join(tmpdir(), 'ccusage-home-'));
    process.env.HOME = tmpHome;
    projectsDir = join(tmpHome, '.claude', 'projects');
    mkdirSync(projectsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(process.env.HOME, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  describe('pwdToSessionId', () => {
    it('encodes a dot-directory the way Claude Code does', () => {
      const result = pwdToSessionId('/Users/me/proj/.claude/worktrees/feat-x');
      assert.equal(result, '-Users-me-proj--claude-worktrees-feat-x');
    });
  });

  describe('hasSessionData', () => {
    it('finds transcripts nested under subagent directories', () => {
      makeSession('-repo--claude-worktrees-a');
      assert.equal(hasSessionData('-repo--claude-worktrees-a'), true);
    });

    it('reports an existing but emptied project directory as having no data', () => {
      makeSession('-repo--claude-worktrees-b', { withData: false });
      assert.equal(hasSessionData('-repo--claude-worktrees-b'), false,
        'a removed worktree leaves the directory behind without transcripts');
    });

    it('reports a missing project directory as having no data', () => {
      assert.equal(hasSessionData('-nope'), false);
    });
  });

  describe('findWorktreeSessionId', () => {
    it('derives the session from a live worktree path', () => {
      makeSession('-Users-me-proj--claude-worktrees-feat-x');
      const result = findWorktreeSessionId('/Users/me/proj', 'feat-x', '/Users/me/proj/.claude/worktrees/feat-x');
      assert.equal(result.sessionId, '-Users-me-proj--claude-worktrees-feat-x');
      assert.equal(result.resolvedBy, 'worktree');
      assert.equal(result.hasData, true);
    });

    it('recovers the session by branch name after the worktree is removed', () => {
      makeSession('-Users-me-proj--claude-worktrees-feat-x');
      const result = findWorktreeSessionId('/Users/me/proj', 'feat-x', null);
      assert.equal(result.sessionId, '-Users-me-proj--claude-worktrees-feat-x');
      assert.equal(result.resolvedBy, 'branch-name');
    });

    it('matches a worktree root convention other than .claude/worktrees', () => {
      makeSession('-Users-me-proj--worktrees-feat-y');
      const result = findWorktreeSessionId('/Users/me/proj', 'feat-y', null);
      assert.equal(result.sessionId, '-Users-me-proj--worktrees-feat-y');
    });

    it('encodes a slash in the branch name', () => {
      makeSession('-Users-me-proj--claude-worktrees-feat-z');
      const result = findWorktreeSessionId('/Users/me/proj', 'feat/z', null);
      assert.equal(result.sessionId, '-Users-me-proj--claude-worktrees-feat-z');
    });

    it('reports the session it found even when the transcripts are gone', () => {
      makeSession('-Users-me-proj--claude-worktrees-feat-gone', { withData: false });
      const result = findWorktreeSessionId('/Users/me/proj', 'feat-gone', null);
      assert.equal(result.sessionId, '-Users-me-proj--claude-worktrees-feat-gone');
      assert.equal(result.hasData, false);
    });

    it('returns no session when nothing matches the branch', () => {
      const result = findWorktreeSessionId('/Users/me/proj', 'never-existed', null);
      assert.equal(result.sessionId, null);
      assert.equal(result.resolvedBy, 'none');
    });

    it('does not match a branch belonging to a different repository', () => {
      makeSession('-Users-me-other--claude-worktrees-feat-x');
      const result = findWorktreeSessionId('/Users/me/proj', 'feat-x', null);
      assert.equal(result.sessionId, null);
    });
  });
});
