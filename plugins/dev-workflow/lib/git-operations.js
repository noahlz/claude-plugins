import { execFileSync } from 'child_process';

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
      stderr: error.stderr || '',
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

/**
 * Get the cost metrics from the most recent commit with a Claude-Cost-Metrics trailer.
 * Searches backwards through git log, not just HEAD.
 * Uses full commit body parsing rather than %(trailers:...) format for reliability.
 * @param {Object} options - { cwd }
 * @returns {Array} - Array of cost objects, or empty array if none found
 */
export function getPreviousCostMetrics(options = {}) {
  try {
    const result = execGit(
      ['log', `--format=%B${COMMIT_DELIMITER}`],
      options
    );

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return [];
    }

    // Split on delimiter to get individual commit bodies (most recent first)
    const commits = result.stdout.split(COMMIT_DELIMITER);
    for (const commitBody of commits) {
      if (!commitBody.trim()) continue;
      // Scan lines for the Claude-Cost-Metrics trailer
      for (const line of commitBody.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(COST_TRAILER_PREFIX)) continue;
        const jsonStr = trimmed.slice(COST_TRAILER_PREFIX.length).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.cost)) {
            return parsed.cost;
          }
        } catch {
          // Malformed JSON in this commit, try next
        }
        break; // Found trailer line but invalid — move to next commit
      }
    }

    return [];
  } catch {
    return [];
  }
}

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
 * @param {string} sessionId - The session ID to match (e.g. "-Users-foo-bar")
 * @param {Object} options - { cwd }
 * @returns {string|null} ISO 8601 date string or null if no matching commit found
 */
export function getLastCostCommitDate(sessionId, options = {}) {
  try {
    // %aI = author date ISO 8601; output one date line then the full body per commit
    const result = execGit(
      ['log', `--format=%aI%n%B${COMMIT_DELIMITER}`],
      options
    );

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return null;
    }

    // Split on delimiter to get individual commit blocks (most recent first).
    // Each block starts with the author date on the first non-empty line, followed by the commit body.
    // Note: %B appends a trailing newline before the delimiter, so blocks after the first start
    // with an empty line — we must find the first non-empty line to locate the date.
    const blocks = result.stdout.split(COMMIT_DELIMITER);
    for (const block of blocks) {
      const lines = block.split('\n');
      const dateIndex = lines.findIndex(l => l.trim() !== '');
      if (dateIndex === -1) continue;
      const commitDate = lines[dateIndex].trim();

      for (const line of lines.slice(dateIndex + 1)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(COST_TRAILER_PREFIX)) continue;
        const jsonStr = trimmed.slice(COST_TRAILER_PREFIX.length).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.sessionId === sessionId) {
            return commitDate;
          }
        } catch {
          // Malformed JSON — skip this commit
        }
        break; // Found trailer line but didn't match — move to next commit
      }
    }

    return null;
  } catch {
    return null;
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
