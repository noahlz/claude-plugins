#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as git from '../../../lib/git-operations.js';
import * as ccusage from '../../../lib/ccusage-operations.js';
import { computeCosts, createDefaultDeps as createCostDeps } from '../../../lib/cost-computation.js';
import { readSessionConfig } from '../../../lib/file-utils.js';
import { createCommit, readCommitMessage } from '../../../lib/commit-operations.js';
import { pathToFileURL } from 'url';


/**
 * Create default dependency objects for production use
 * @returns {object} Dependencies object with git, cost, and ccusage operations
 */
function createDefaultDeps() {
  return {
    git: {
      execGit: git.execGit,
      commit: git.commit,
      getHeadSha: git.getHeadSha,
      getPreviousCostMetrics: git.getPreviousCostMetrics,
      getLastCostCommitDate: git.getLastCostCommitDate
    },
    cost: {
      computeCosts,
      ...createCostDeps()
    },
    ccusage: {
      getProjectsDir: ccusage.getProjectsDir,
      listLocalSessions: ccusage.listLocalSessions,
      findRecommendedSession: ccusage.findRecommendedSession,
      pwdToSessionId: ccusage.pwdToSessionId,
      validateCostMetrics: ccusage.validateCostMetrics,
      filterZeroUsageCosts: ccusage.filterZeroUsageCosts,
      getCleanupPeriodDays: ccusage.getCleanupPeriodDays
    }
  };
}

/**
 * Save session configuration
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory (defaults to current dir)
 * @param {string} options.sessionId - Session ID to save
 * @returns {object} - { status, data, message }
 */
function saveConfig({ baseDir = '.', sessionId } = {}) {
  if (!sessionId) {
    return {
      status: 'error',
      data: {},
      message: 'sessionId parameter required'
    };
  }

  try {
    const configPath = path.join(baseDir, '.claude/settings.plugins.commit-with-costs.json');
    const configDir = path.dirname(configPath);

    // Create .claude directory if needed
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write config
    const config = { sessionId };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return {
      status: 'success',
      data: { session_id: sessionId },
      message: 'Configuration saved'
    };
  } catch (error) {
    return {
      status: 'error',
      data: {},
      message: `Failed to save config: ${error.message}`
    };
  }
}

/**
 * Prepare for commit: fetch costs for a given session ID using incremental mode when possible
 * @param {object} options - Options
 * @param {string} options.baseDir - Base directory
 * @param {string} options.sessionId - Session ID to fetch costs for (required if no config)
 * @param {object} options.deps - Dependencies object (required)
 * @returns {Promise<object>} - { status, data, message }
 */
async function prepare(options = {}) {
  const { baseDir = '.', sessionId: providedSessionId, deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { ccusage: ccusageOps, git: gitOps, cost: costOps } = deps;

  try {
    let sessionId = providedSessionId;

    // Resolve session ID
    if (!sessionId || sessionId === 'NOT_CONFIGURED') {
      const recommendation = ccusageOps.findRecommendedSession(baseDir);
      if (recommendation.match) {
        sessionId = recommendation.sessionId;
      } else {
        return {
          status: 'not_found',
          data: { calculated_session_id: ccusageOps.pwdToSessionId(path.resolve(baseDir)) },
          message: 'Session not found for current directory'
        };
      }
    }

    // Anchor incremental cost to the last commit with a matching cost trailer for this session.
    // This skips ad-hoc commits, merge commits, and commits from other session IDs.
    const lastCommitDate = gitOps.getLastCostCommitDate(sessionId, { cwd: baseDir });

    // Compute costs (incremental if lastCommitDate exists, cumulative if null)
    const costResult = await costOps.computeCosts(sessionId, lastCommitDate);

    if (!costResult.success) {
      return {
        status: 'error',
        data: { session_id: sessionId },
        message: costResult.error
      };
    }

    // Validate costs before returning success
    if (!ccusageOps.validateCostMetrics(costResult.costs)) {
      return {
        status: 'invalid_costs',
        data: { session_id: sessionId, costs: costResult.costs },
        message: 'Cost metrics validation failed: metrics are empty, missing required fields, or all values are zero'
      };
    }

    return {
      status: 'success',
      data: {
        session_id: sessionId,
        method: costResult.method,
        since: costResult.since,
        current_cost: costResult.costs,
        cleanup_period_days: ccusageOps.getCleanupPeriodDays()
      },
      message: 'Session costs resolved'
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/**
 * Create a git commit with cost metrics footer.
 * SESSION_ID, CURRENT_COST, method, and since are provided by skill orchestration.
 * @param {object} options - See lib/commit-operations.js createCommit
 * @returns {Promise<object>} - { status, data, message }
 */
async function commit(options = {}) {
  return createCommit(options);
}

/**
 * CLI entry point
 */
async function main() {
  const action = process.argv[2];

  let result;
  let outputFile;

  // Parse CLI arguments
  const args = process.argv.slice(3);

  /* node:coverage disable */
  // Create real dependency objects for all actions that need them
  const deps = createDefaultDeps();

  try {
    switch (action) {
      case 'list-sessions': {
        outputFile = args[0];
        result = deps.ccusage.listLocalSessions();
        break;
      }

      case 'fetch-cost':
      case 'prepare': {
        const configIdx = args.indexOf('--config');
        let baseDir, sessionId;
        if (configIdx !== -1) {
          // Read sessionId from config file (avoids passing hyphen-prefixed IDs as CLI args)
          const config = readSessionConfig(args[configIdx + 1]);
          sessionId = config.sessionId;
          baseDir = process.cwd();
        } else {
          // Legacy: positional args for backwards compatibility
          baseDir = args[0] || '.';
          sessionId = args[1] || null;
        }
        const flagValues = new Set([configIdx].filter(i => i !== -1).flatMap(i => [i, i + 1]));
        outputFile = args.find((a, i) => !flagValues.has(i) && (configIdx !== -1 || i >= 2));
        result = await prepare({ baseDir, sessionId, deps });
        break;
      }

      case 'save-config': {
        const baseDir = args[0] || '.';
        const sessionId = args[1];
        outputFile = args[2];
        result = saveConfig({ baseDir, sessionId });
        break;
      }

      case 'commit': {
        const configIdx = args.indexOf('--config');
        const sessionIdIndex = args.indexOf('--session-id');
        const costsIndex = args.indexOf('--costs');
        const methodIndex = args.indexOf('--method');
        const sinceIndex = args.indexOf('--since');

        let sessionId;
        if (configIdx !== -1) {
          // Read sessionId from config file (avoids passing hyphen-prefixed IDs as CLI args)
          const config = readSessionConfig(args[configIdx + 1]);
          sessionId = config.sessionId;
        } else {
          sessionId = sessionIdIndex !== -1 ? args[sessionIdIndex + 1] : null;
        }

        const costs = costsIndex !== -1 ? args[costsIndex + 1] : null;
        const method = methodIndex !== -1 ? args[methodIndex + 1] : 'cumulative';
        const since = sinceIndex !== -1 ? args[sinceIndex + 1] : null;

        result = await commit({ baseDir: '.', sessionId, costs, method, since, deps });
        break;
      }

      default:
        outputFile = args[0];
        result = {
          status: 'error',
          data: {},
          message: `Unknown action: ${action}`
        };
        break;
    }

    // Never treat a flag-like token (e.g. a misparsed "--session-id") as an output
    // file path. Writing JSON to such a path is how stray "--session" files appeared
    // on Windows. A leading "-" always indicates a misparse, so fall back to stdout.
    if (outputFile && outputFile.startsWith('-')) {
      outputFile = undefined;
    }

    // Output result as JSON
    const output = JSON.stringify(result, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    const errorResult = {
      status: 'error',
      data: {},
      message: error.message
    };

    const output = JSON.stringify(errorResult, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(1);
  }
}

// Export functions for testing
export { saveConfig, prepare, commit, readCommitMessage };

// CLI entry guard
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.log(JSON.stringify({
      status: 'error',
      data: {},
      message: err.message
    }, null, 2));
    process.exit(1);
  });
}
/* node:coverage enable */
