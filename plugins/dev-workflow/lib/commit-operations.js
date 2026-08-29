import { Readable } from 'stream';

const ATTRIBUTION = 'Co-Authored-By: Claude Code <noreply@anthropic.com>';

/**
 * Read a commit message from a stream, splitting subject from body.
 * @param {Readable|null} inputStream - Defaults to process.stdin
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function readCommitMessage(inputStream = null) {
  const stream = inputStream || process.stdin;

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const message = Buffer.concat(chunks).toString('utf8').trim();
  const lines = message.split('\n');

  const subject = lines[0] || '';
  let body = '';

  // Skip the blank line separating subject from body
  const bodyStartIdx = lines[1] === '' ? 2 : 1;

  if (lines.length > bodyStartIdx) {
    body = lines.slice(bodyStartIdx).join('\n').trim();
  }

  return { subject, body };
}

/**
 * Assemble the full commit message with attribution and cost trailers.
 * `since` is omitted when absent, as it does not apply in cumulative mode.
 * `sessionId` goes last to keep the compact fields at the front of the trailer.
 * @returns {string}
 */
export function buildCommitMessage({ subject, body, method, costs, since, sessionId }) {
  const trailer = JSON.stringify({
    method,
    cost: costs,
    ...(since ? { since } : {}),
    sessionId
  });

  const parts = [subject];
  if (body) parts.push(body);
  parts.push(`${ATTRIBUTION}\nClaude-Cost-Metrics: ${trailer}`);

  return parts.join('\n\n');
}

/**
 * Create a git commit carrying cost metrics.
 *
 * Works for both ordinary and merge commits: with MERGE_HEAD present, `git commit -F -`
 * records the staged merge with all of its parents.
 *
 * @param {object} options
 * @param {string} options.baseDir
 * @param {string} options.sessionId
 * @param {string|Array} options.costs - Cost metrics, JSON string or array
 * @param {string} options.method - 'inc', 'cum', or 'merge'
 * @param {string|null} options.since
 * @param {string|null} options.message - Commit message; reads stdin when null
 * @param {object} options.deps - { git, ccusage }
 * @returns {Promise<{status: string, data: object, message: string}>}
 */
export async function createCommit(options = {}) {
  const {
    baseDir = '.',
    sessionId = null,
    costs = null,
    method = 'cum',
    since = null,
    message: providedMessage = null,
    deps
  } = options;

  if (!deps) {
    throw new Error('deps parameter required');
  }

  const { git: gitOps, ccusage: ccusageOps } = deps;

  try {
    // Readable.from a provided message, otherwise fall through to stdin
    const inputStream = providedMessage !== null && providedMessage !== undefined
      ? Readable.from([Buffer.from(providedMessage)])
      : null;

    const { subject, body } = await readCommitMessage(inputStream);

    if (!subject) {
      return { status: 'error', data: {}, message: 'Missing commit subject (first line of stdin)' };
    }

    if (!sessionId) {
      return { status: 'error', data: {}, message: 'Session ID not provided (use --session-id argument)' };
    }

    if (!costs) {
      return { status: 'error', data: {}, message: 'Cost metrics not provided (use --costs argument)' };
    }

    let currentCost = costs;
    if (typeof currentCost === 'string') {
      try {
        currentCost = JSON.parse(currentCost);
      } catch (error) {
        return { status: 'error', data: {}, message: `Invalid JSON in --costs argument: ${error.message}` };
      }
    }

    const costsArray = Array.isArray(currentCost) ? currentCost : [currentCost];
    const { filtered } = ccusageOps.filterZeroUsageCosts(costsArray);

    if (!ccusageOps.validateCostMetrics(filtered)) {
      return {
        status: 'metrics_invalid',
        data: { session_id: sessionId, attempted_costs: filtered },
        message: 'Cost metrics validation failed'
      };
    }

    const fullMessage = buildCommitMessage({ subject, body, method, costs: filtered, since, sessionId });

    const commitResult = gitOps.commit(fullMessage, { cwd: baseDir });
    if (commitResult.exitCode !== 0) {
      return {
        status: 'git_error',
        data: { error_message: commitResult.stderr },
        message: 'Failed to create git commit'
      };
    }

    const commitSha = gitOps.getHeadSha({ cwd: baseDir });
    if (!commitSha) {
      return { status: 'git_error', data: {}, message: 'Failed to retrieve commit SHA' };
    }

    // Anything still staged means the commit did not take
    const stagedResult = gitOps.execGit(['diff', '--cached', '--name-only'], { cwd: baseDir });
    if (stagedResult.stdout.trim()) {
      return {
        status: 'git_error',
        data: { staged_changes: stagedResult.stdout },
        message: 'Git commit execution failed - changes still staged'
      };
    }

    return { status: 'success', data: { commit_sha: commitSha }, message: 'Commit created successfully' };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}
