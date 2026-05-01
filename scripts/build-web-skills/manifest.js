/**
 * Manifest of skills to package as claude.ai-uploadable ZIP archives.
 *
 * Each entry describes one skill ZIP. LICENSE and an attribution README.md are
 * added unconditionally to every entry — no per-entry flags.
 *
 * Fields:
 *   name           Folder name inside the zip (must be claude.ai-valid).
 *   plugin         Source plugin (informational; matches plugins/<plugin>/...).
 *   source         Repo-relative path to the skill source directory.
 *   include        Files to copy from the source dir into the staging dir.
 *                  SKILL.md is required; everything else is opt-in.
 *   sourceReadme?  Optional source README path (relative to source) to fold
 *                  into the generated attribution README under "About".
 *   prep?          Optional prep hook name; runs after copy + frontmatter clean.
 */

import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST = [
  {
    name: 'de-llm',
    plugin: 'writing-tools',
    source: 'plugins/writing-tools/skills/de-llm',
    include: ['SKILL.md', 'references/patterns.md'],
  },
  {
    name: 'craft-linkedin-post',
    plugin: 'writing-tools',
    source: 'plugins/writing-tools/skills/craft-linkedin-post',
    include: ['SKILL.md'],
    prep: 'craft-linkedin-post',
  },
  {
    name: 'tighten-for-llms',
    plugin: 'dev-workflow',
    source: 'plugins/dev-workflow/skills/tighten-for-llms',
    include: ['SKILL.md'],
    sourceReadme: 'README.md',
  },
];

const REQUIRED_FIELDS = ['name', 'plugin', 'source', 'include'];
const NAME_RE = /^[a-z0-9-]{1,64}$/;

// Throws on first violation; error message identifies the offending entry.
export function validateManifest(manifest, repoRoot) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('validateManifest: manifest must be a non-empty array');
  }

  const seenNames = new Set();
  for (const entry of manifest) {
    const label = entry?.name ?? '<unnamed>';

    for (const field of REQUIRED_FIELDS) {
      if (entry[field] === undefined) {
        throw new Error(`validateManifest [${label}]: missing required field "${field}"`);
      }
    }

    if (!NAME_RE.test(entry.name)) {
      throw new Error(
        `validateManifest [${label}]: name must be 1–64 lowercase letters/digits/hyphens`
      );
    }
    if (seenNames.has(entry.name)) {
      throw new Error(`validateManifest [${label}]: duplicate name`);
    }
    seenNames.add(entry.name);

    if (!Array.isArray(entry.include) || entry.include.length === 0) {
      throw new Error(`validateManifest [${label}]: "include" must be a non-empty array`);
    }
    if (!entry.include.includes('SKILL.md')) {
      throw new Error(`validateManifest [${label}]: "include" must contain "SKILL.md"`);
    }

    const sourceAbs = path.join(repoRoot, entry.source);
    if (!fs.existsSync(sourceAbs)) {
      throw new Error(`validateManifest [${label}]: source dir not found at ${entry.source}`);
    }
    for (const rel of entry.include) {
      if (!fs.existsSync(path.join(sourceAbs, rel))) {
        throw new Error(`validateManifest [${label}]: include file not found: ${rel}`);
      }
    }
    if (entry.sourceReadme && !fs.existsSync(path.join(sourceAbs, entry.sourceReadme))) {
      throw new Error(
        `validateManifest [${label}]: sourceReadme not found: ${entry.sourceReadme}`
      );
    }
  }
}
