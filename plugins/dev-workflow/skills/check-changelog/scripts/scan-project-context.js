#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { readFileSafe } from '../../../lib/file-utils.js';

/**
 * @returns {{ fs: typeof fs, readFileSafe: typeof readFileSafe }}
 */
export function createDefaultDeps() {
  return { fs, readFileSafe };
}

/**
 * Scan CLAUDE.md files at known locations relative to cwd.
 * Returns an array of found files with a short content preview.
 * @param {string} cwd
 * @param {object} deps
 * @returns {Array<{ path: string, preview: string }>}
 */
function scanClaudeMdFiles(cwd, deps) {
  const candidates = ['CLAUDE.md', 'src/CLAUDE.md', '.claude/CLAUDE.md'];
  const found = [];

  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (!deps.fs.existsSync(fullPath)) continue;

    const content = deps.readFileSafe(fullPath, { label: candidate, fs: deps.fs });
    found.push({ path: candidate, preview: content.slice(0, 500) });
  }

  return found;
}

/**
 * Scan the .claude/ directory for settings and hook configuration.
 * @param {string} cwd
 * @param {object} deps
 * @returns {{ exists: boolean, settingKeys: string[], hasHooks: boolean, parsedSettings: object|null }}
 */
function scanClaudeDir(cwd, deps) {
  const claudeDir = path.join(cwd, '.claude');

  if (!deps.fs.existsSync(claudeDir)) {
    return { exists: false, settingKeys: [], hasHooks: false, parsedSettings: null };
  }

  let settingKeys = [];
  let parsedSettings = null;
  const settingsPath = path.join(claudeDir, 'settings.json');

  if (deps.fs.existsSync(settingsPath)) {
    const content = deps.readFileSafe(settingsPath, { label: 'settings.json', fs: deps.fs });
    parsedSettings = JSON.parse(content);
    settingKeys = Object.keys(parsedSettings);
  }

  // Hooks can live as a dedicated file or as a key inside settings.json
  const hooksFilePath = path.join(claudeDir, 'hooks.json');
  const hasHooksFile = deps.fs.existsSync(hooksFilePath);
  const hasHooksKey = parsedSettings !== null && 'hooks' in parsedSettings;
  const hasHooks = hasHooksFile || hasHooksKey;

  return { exists: true, settingKeys, hasHooks, parsedSettings };
}

/**
 * Check which well-known project type indicator files are present in cwd.
 * @param {string} cwd
 * @param {object} deps
 * @returns {string[]}
 */
function scanProjectTypes(cwd, deps) {
  const indicators = [
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'Gemfile',
    'Makefile',
    'CMakeLists.txt',
  ];

  return indicators.filter(name => deps.fs.existsSync(path.join(cwd, name)));
}

/**
 * Extract plugin identifiers from parsed settings.json.
 * Looks for top-level keys whose names or values suggest plugin configuration.
 * @param {object|null} parsedSettings
 * @returns {string[]}
 */
function extractPlugins(parsedSettings) {
  if (!parsedSettings) return [];

  const pluginKeys = Object.keys(parsedSettings).filter(k => k.toLowerCase().includes('plugin'));
  const plugins = [];

  for (const key of pluginKeys) {
    const value = parsedSettings[key];
    if (Array.isArray(value)) {
      plugins.push(...value.map(String));
    } else if (typeof value === 'string') {
      plugins.push(value);
    } else if (typeof value === 'object' && value !== null) {
      plugins.push(...Object.keys(value));
    }
  }

  return plugins;
}

/**
 * Scan cwd for project context relevant to Claude Code changelog assessment.
 * @param {string} cwd - Directory to scan
 * @param {object} deps - Injected dependencies ({ fs, readFileSafe })
 * @returns {{ status: "success", data: object } | { status: "error", error: string }}
 */
export function scanProjectContext(cwd, deps) {
  if (!deps) throw new Error('deps is required');

  try {
    const claudeMdFiles = scanClaudeMdFiles(cwd, deps);
    const { parsedSettings, ...claudeDir } = scanClaudeDir(cwd, deps);
    const projectTypes = scanProjectTypes(cwd, deps);
    const plugins = extractPlugins(parsedSettings);

    return {
      status: 'success',
      data: { claudeMdFiles, claudeDir, projectTypes, plugins },
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/* node:coverage disable */
function main() {
  const argv = process.argv.slice(2);
  let cwd = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cwd' && argv[i + 1] !== undefined) {
      cwd = argv[++i];
    }
  }

  const result = scanProjectContext(cwd, createDefaultDeps());
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
/* node:coverage enable */
