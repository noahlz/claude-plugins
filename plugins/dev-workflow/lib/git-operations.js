import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * Run a git command with arguments passed verbatim (no shell).
 * execFileSync rather than execSync so branch names and format strings containing
 * shell metacharacters reach git unmangled.
 */
export function execGit(args, options = {}) {
  const { cwd = process.cwd(), input = '' } = options;

  try {
    const result = execFileSync('git', args, {
      cwd,
      input,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return {
      stdout: result,
      stderr: '',
      exitCode: 0
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      // ENOBUFS and spawn failures leave stderr empty; the message is the only clue
      stderr: error.stderr || error.message || '',
      exitCode: error.status || 1
    };
  }
}

export function commit(message, options = {}) {
  return execGit(['commit', '-F', '-'], { ...options, input: message });
}

export function getHeadSha(options = {}) {
  const result = execGit(['rev-parse', 'HEAD'], options);
  return result.stdout.trim();
}

/**
 * Absolute path of the repository working tree root.
 * @param {Object} options - { cwd }
 * @returns {string|null}
 */
export function getRepoRoot(options = {}) {
  const result = execGit(['rev-parse', '--show-toplevel'], options);
  return result.exitCode === 0 ? result.stdout.trim() || null : null;
}

const COMMIT_DELIMITER = '---COMMIT-END---';
const COST_TRAILER_PREFIX = 'Claude-Cost-Metrics: ';
const ANCHOR_PAGE_SIZE = 20;

/**
 * Get the ISO 8601 author date of the most recent commit that has a Claude-Cost-Metrics
 * trailer matching the given sessionId.
 *
 * Why not just use the most recent commit's date?
 * - Ad-hoc commits (no cost trailer) and merge commits shift the "since" timestamp forward,
 *   causing costs incurred before those commits to be counted as zero.
 * - Multi-author repos may have commits from different session IDs; we should only anchor
 *   incremental cost against a commit for the same session.
 *
 * A trailer matches when its `sessionId` is this session or its `pooled` list names it: a
 * merge commit that pooled a worktree session's cost anchors that session too.
 *
 * git's --grep narrows the log to commits mentioning both the trailer and the quoted session
 * id, read a page at a time, so output stays small however long the history grows. Quoting
 * keeps "-Users-me-proj" from matching "-Users-me-proj--claude-worktrees-x". A grep hit is only
 * a candidate: the first trailer line must parse and carry this session (a squash commit can
 * hold another session's trailer first).
 *
 * @param {string} sessionId - The session ID to match (e.g. "-Users-foo-bar")
 * @param {Object} options - { cwd, revs } where revs are the revisions `git log` walks
 *   (default ['HEAD']); pass merged branches to find trailers not yet reachable from HEAD
 * @returns {string|null} ISO 8601 date string, or null if no matching commit (or no commits) exist
 * @throws {Error} when git fails while reading history, so a failure can't pass for "no anchor"
 */
export function getLastCostCommitDate(sessionId, options = {}) {
  const { revs = ['HEAD'], ...gitOptions } = options;
  if (execGit(['rev-parse', '--verify', '--quiet', 'HEAD'], gitOptions).exitCode !== 0) {
    return null;
  }

  for (let skip = 0; ; skip += ANCHOR_PAGE_SIZE) {
    const result = execGit([
      'log', `-n${ANCHOR_PAGE_SIZE}`, `--skip=${skip}`,
      '--all-match', '--fixed-strings',
      `--grep=${COST_TRAILER_PREFIX}`,
      `--grep=${JSON.stringify(sessionId)}`,
      `--format=%aI%n%B${COMMIT_DELIMITER}`,
      ...revs,
      '--'
    ], gitOptions);

    if (result.exitCode !== 0) {
      throw new Error(`git log failed while looking for the cost anchor: ${result.stderr.trim()}`);
    }

    // Each block holds the author date on its first non-empty line, then the body.
    // %B ends with a newline, so every block after the first starts with an empty line.
    const blocks = result.stdout.split(COMMIT_DELIMITER).filter(b => b.trim());
    for (const block of blocks) {
      const lines = block.split('\n');
      const dateIndex = lines.findIndex(l => l.trim() !== '');
      const commitDate = lines[dateIndex].trim();

      // --grep matches anywhere in a line; a mid-line mention has no trailer line to read
      const trailerLine = lines.slice(dateIndex + 1).find(l => l.trim().startsWith(COST_TRAILER_PREFIX));
      if (!trailerLine) continue;
      try {
        const parsed = JSON.parse(trailerLine.trim().slice(COST_TRAILER_PREFIX.length));
        if (parsed && (parsed.sessionId === sessionId || (Array.isArray(parsed.pooled) && parsed.pooled.includes(sessionId)))) {
          return commitDate;
        }
      } catch {
        // Malformed JSON – skip this commit
      }
    }

    if (blocks.length < ANCHOR_PAGE_SIZE) {
      return null;
    }
  }
}

/**
 * List registered worktrees.
 * The first porcelain record is always the main worktree; the rest are linked worktrees.
 * @param {Object} options - { cwd }
 * @returns {Array<{path: string, branch: string|null, isMain: boolean, locked: boolean}>}
 */
export function listWorktrees(options = {}) {
  const result = execGit(['worktree', 'list', '--porcelain'], options);
  if (result.exitCode !== 0) return [];

  const worktrees = [];
  let current = null;

  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: line.slice('worktree '.length).trim(), branch: null, isMain: worktrees.length === 0, locked: false };
    } else if (!current) {
      continue;
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '');
    } else if (line.startsWith('locked')) {
      current.locked = true;
    }
  }
  if (current) worktrees.push(current);

  return worktrees;
}

/**
 * Local branch names holding commits not reachable from HEAD.
 * @param {Object} options - { cwd }
 * @returns {Array<string>}
 */
export function listUnmergedBranches(options = {}) {
  const result = execGit(['branch', '--no-merged', 'HEAD', '--format=%(refname:short)'], options);
  if (result.exitCode !== 0) return [];

  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * Number of commits on `branch` that are not reachable from HEAD.
 * @param {string} branch
 * @param {Object} options - { cwd }
 * @returns {number}
 */
export function countCommitsAhead(branch, options = {}) {
  const result = execGit(['rev-list', '--count', `HEAD..${branch}`], options);
  if (result.exitCode !== 0) return 0;
  const count = parseInt(result.stdout.trim(), 10);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Start a merge without committing, leaving MERGE_HEAD for the caller to commit.
 * Two or more branches produce an octopus merge, which refuses to run at all if any
 * branch conflicts — the caller is expected to abort and report.
 * @param {Array<string>} branches
 * @param {Object} options - { cwd }
 */
export function mergeNoCommit(branches, options = {}) {
  return execGit(['merge', '--no-ff', '--no-commit', ...branches], options);
}

export function mergeAbort(options = {}) {
  return execGit(['merge', '--abort'], options);
}

/**
 * True when MERGE_HEAD exists, i.e. a merge is staged but not yet committed.
 * @param {Object} options - { cwd }
 * @returns {boolean}
 */
export function isMergeInProgress(options = {}) {
  return execGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'], options).exitCode === 0;
}

/**
 * Paths with unresolved merge conflicts.
 * @param {Object} options - { cwd }
 * @returns {Array<string>}
 */
export function listConflictedPaths(options = {}) {
  const result = execGit(['diff', '--name-only', '--diff-filter=U'], options);
  if (result.exitCode !== 0) return [];
  return result.stdout.split('\n').map(l => l.trim()).filter(Boolean);
}

/**
 * True when cwd is a linked worktree rather than the main working tree.
 * A linked worktree's own git dir sits under the main repository's common dir,
 * so the two paths differ only there.
 * @param {Object} options - { cwd }
 * @returns {boolean}
 */
export function isLinkedWorktree(options = {}) {
  const gitDir = execGit(['rev-parse', '--absolute-git-dir'], options);
  const commonDir = execGit(['rev-parse', '--path-format=absolute', '--git-common-dir'], options);
  if (gitDir.exitCode !== 0 || commonDir.exitCode !== 0) return false;
  return gitDir.stdout.trim() !== commonDir.stdout.trim();
}

/**
 * Absolute path of the main working tree, which `git worktree list` always reports first.
 * @param {Object} options - { cwd }
 * @returns {string|null}
 */
export function getMainWorktreePath(options = {}) {
  const [main] = listWorktrees(options);
  return main ? main.path : null;
}

/**
 * Read a git config value.
 * @param {string} key - e.g. "rerere.enabled"
 * @param {Object} options - { cwd }
 * @returns {string|null} - null when unset
 */
export function getConfigValue(key, options = {}) {
  const result = execGit(['config', '--get', key], options);
  return result.exitCode === 0 ? result.stdout.trim() || null : null;
}

/**
 * Stage paths. `--` keeps a path that looks like an option from being read as one.
 * @param {Array<string>} paths
 * @param {Object} options - { cwd }
 */
export function stagePaths(paths, options = {}) {
  return execGit(['add', '--', ...paths], options);
}

/**
 * True when a conflicted path is safe to stage: it exists, is text, and no longer holds
 * conflict markers.
 *
 * This is how a path rerere already settled is told from one still needing hands — rerere
 * writes its recorded resolution into the working file but leaves the index entry unmerged,
 * so the index alone cannot distinguish the two. Anything unreadable, binary, or deleted
 * returns false: a modify/delete or binary conflict is a decision for a person.
 *
 * @param {string} filePath - Absolute or cwd-relative path
 * @returns {boolean}
 */
export function isMarkerFree(filePath) {
  try {
    const buffer = readFileSync(filePath);
    if (buffer.subarray(0, 8192).includes(0)) return false;

    const content = buffer.toString('utf-8');
    return !(/^<{7} /m.test(content) && /^={7}$/m.test(content) && /^>{7} /m.test(content));
  } catch {
    return false;
  }
}
