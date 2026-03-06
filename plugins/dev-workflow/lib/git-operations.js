import { execSync } from 'child_process';

export function execGit(args, options = {}) {
  const { cwd = process.cwd(), input = '' } = options;

  try {
    const result = execSync(`git ${args.join(' ')}`, {
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
