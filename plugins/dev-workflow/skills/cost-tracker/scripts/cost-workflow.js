#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as ccusage from '../../../lib/ccusage-operations.js';
import * as git from '../../../lib/git-operations.js';
import { computeCosts, createDefaultDeps as createCostDeps } from '../../../lib/cost-computation.js';

function createDefaultDeps() {
  return {
    git: {
      getLastCommitDate: git.getLastCommitDate
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
      validateCostMetrics: ccusage.validateCostMetrics
    }
  };
}

/**
 * Fetch and compute costs for a session
 * @param {object} options - { baseDir, sessionId, deps }
 * @returns {Promise<object>} - { status, data, message }
 */
async function fetchCost(options = {}) {
  const { baseDir = '.', sessionId: providedSessionId, deps } = options;
  if (!deps) throw new Error('deps parameter required');

  const { ccusage: ccusageOps, git: gitOps, cost: costOps } = deps;

  try {
    let sessionId = providedSessionId;

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

    const lastCommitDate = gitOps.getLastCommitDate({ cwd: baseDir });
    const costResult = await costOps.computeCosts(sessionId, lastCommitDate);

    if (!costResult.success) {
      return {
        status: 'error',
        data: { session_id: sessionId },
        message: costResult.error
      };
    }

    if (!ccusageOps.validateCostMetrics(costResult.costs)) {
      return {
        status: 'invalid_costs',
        data: { session_id: sessionId, costs: costResult.costs },
        message: 'Cost metrics validation failed'
      };
    }

    return {
      status: 'success',
      data: {
        session_id: sessionId,
        method: costResult.method,
        since: costResult.since,
        current_cost: costResult.costs
      },
      message: 'Session costs resolved'
    };
  } catch (error) {
    return { status: 'error', data: {}, message: error.message };
  }
}

/* node:coverage disable */
async function main() {
  const action = process.argv[2];
  const args = process.argv.slice(3);
  const deps = createDefaultDeps();
  let result;
  let outputFile;

  try {
    switch (action) {
      case 'list-sessions': {
        outputFile = args[0];
        result = deps.ccusage.listLocalSessions();
        break;
      }

      case 'fetch-cost': {
        const baseDir = args[0] || '.';
        const sessionId = args[1] || null;
        outputFile = args[2];
        result = await fetchCost({ baseDir, sessionId, deps });
        break;
      }

      default:
        outputFile = args[0];
        result = { status: 'error', data: {}, message: `Unknown action: ${action}` };
        break;
    }

    const output = JSON.stringify(result, null, 2);
    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }

    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    const errorResult = { status: 'error', data: {}, message: error.message };
    const output = JSON.stringify(errorResult, null, 2);
    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }
    process.exit(1);
  }
}

export { createDefaultDeps, fetchCost };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.log(JSON.stringify({ status: 'error', data: {}, message: err.message }, null, 2));
    process.exit(1);
  });
}
/* node:coverage enable */
