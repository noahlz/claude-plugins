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
