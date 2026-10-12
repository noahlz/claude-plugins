#!/usr/bin/env node

// Locates, reads, and writes per-project skill configs (.claude/settings.plugins.<skill>.json).
//
// Paths resolve against the project root, never the working directory: a Claude Code session
// can sit in any subdirectory, and a cwd-relative path there misses the existing config.
// Project root is CLAUDE_PROJECT_DIR when set, else the git toplevel, else cwd. Inside a linked
// worktree the toplevel is the worktree itself: Claude Code keys sessions to the launch
// directory, so a session launched in a worktree needs its own config.
//
// Usage:
//   node skill-config.js check <skill>                  → "✓ Configuration found: <path>" | "NOT_CONFIGURED: <path>"
//   node skill-config.js read <skill>                   → JSON { path, projectRoot, config }
//   node skill-config.js write <skill> <json> [--replace] → JSON { status, path }
// Always exits 0 — callers read the output, not the exit code.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { getRepoRoot } from './git-operations.js';

/**
 * Resolve the project root.
 * @param {object} options - { env, cwd }
 * @returns {string} Absolute path
 */
export function resolveProjectRoot({ env = process.env, cwd = process.cwd() } = {}) {
  if (env.CLAUDE_PROJECT_DIR) return path.resolve(env.CLAUDE_PROJECT_DIR);
  return getRepoRoot({ cwd }) || path.resolve(cwd);
}

/**
 * Absolute path of a skill's config file under the project root.
 * @param {string} skillName - e.g. "commit-with-costs"
 * @param {object} options - { env, cwd }
 * @returns {string}
 */
export function skillConfigPath(skillName, options = {}) {
  return path.join(resolveProjectRoot(options), '.claude', `settings.plugins.${skillName}.json`);
}

/**
 * Read a skill's config.
 * @param {string} skillName
 * @param {object} options - { env, cwd }
 * @returns {{ path: string, projectRoot: string, config: object|null }} config is null when the file is missing
 */
export function readSkillConfig(skillName, options = {}) {
  const projectRoot = resolveProjectRoot(options);
  const configPath = skillConfigPath(skillName, options);
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : null;
  return { path: configPath, projectRoot, config };
}

/**
 * Write a skill's config, refusing to overwrite an existing file unless `replace` is set.
 * @param {string} skillName
 * @param {object} config - Value to serialize
 * @param {object} options - { env, cwd, replace }
 * @returns {{ status: 'created'|'replaced'|'exists', path: string }}
 */
export function writeSkillConfig(skillName, config, { replace = false, ...options } = {}) {
  const configPath = skillConfigPath(skillName, options);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const existed = fs.existsSync(configPath);
  if (existed && !replace) return { status: 'exists', path: configPath };

  // 'wx' fails if the file appeared since the check, so a create never clobbers
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8', flag: replace ? 'w' : 'wx' });
  return { status: existed ? 'replaced' : 'created', path: configPath };
}

/* node:coverage disable */
function main() {
  const [action, skillName, ...rest] = process.argv.slice(2);
  if (!skillName) {
    console.log(JSON.stringify({ status: 'error', message: 'Usage: skill-config.js <check|read|write> <skill> [json] [--replace]' }));
    return;
  }

  try {
    switch (action) {
      case 'check': {
        const configPath = skillConfigPath(skillName);
        console.log(fs.existsSync(configPath) ? `✓ Configuration found: ${configPath}` : `NOT_CONFIGURED: ${configPath}`);
        break;
      }
      case 'read':
        console.log(JSON.stringify(readSkillConfig(skillName), null, 2));
        break;
      case 'write': {
        const config = JSON.parse(rest.find(arg => arg !== '--replace'));
        const result = writeSkillConfig(skillName, config, { replace: rest.includes('--replace') });
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.log(JSON.stringify({ status: 'error', message: `Unknown action: ${action}` }));
    }
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', message: error.message }));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
/* node:coverage enable */
