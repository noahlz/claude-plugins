#!/usr/bin/env node
/**
 * Build claude.ai-uploadable ZIP archives for the skills listed in manifest.js.
 *
 * Run locally:  node scripts/build-web-skills/index.js
 * Run in CI:    invoked by .github/workflows/release-web-skills.yml on tag push.
 *
 * Output: dist/web-skills/<name>-v<version>.zip per manifest entry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MANIFEST, validateManifest } from './manifest.js';
import { cleanFrontmatter } from './clean-frontmatter.js';
import { renderReadme } from './render-readme.js';
import { pack } from './pack.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

function readGitSha() {
  // CI: GitHub provides GITHUB_SHA; trust that over a local git rev-parse.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const full = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    return full.slice(0, 7);
  } catch {
    return 'unknown';
  }
}

function copyInclude(repoRoot, sourceDir, includes, stagingDir) {
  for (const rel of includes) {
    const src = path.join(repoRoot, sourceDir, rel);
    const dest = path.join(stagingDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function loadPrep(name) {
  const mod = await import(`./prep/${name}.js`);
  if (typeof mod.run !== 'function') {
    throw new Error(`prep/${name}.js must export a "run" function`);
  }
  return mod.run;
}

async function buildOne(entry, ctx) {
  const { repoRoot, version, buildDate, gitSha, distRoot } = ctx;
  const stagingDir = path.join(distRoot, entry.name);

  // 1. Clean staging dir.
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  // 2. Copy include files from source.
  copyInclude(repoRoot, entry.source, entry.include, stagingDir);

  // 3. Clean SKILL.md frontmatter and capture parsed name/description for README.
  const skillMdPath = path.join(stagingDir, 'SKILL.md');
  const originalSkill = fs.readFileSync(skillMdPath, 'utf8');
  const { content: cleanedSkill, frontmatter } = cleanFrontmatter(originalSkill);
  fs.writeFileSync(skillMdPath, cleanedSkill);

  // 4. Copy repo-root LICENSE.
  fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(stagingDir, 'LICENSE'));

  // 5. Render attribution README (folding optional sourceReadme).
  let sourceReadmeContent;
  if (entry.sourceReadme) {
    sourceReadmeContent = fs.readFileSync(
      path.join(repoRoot, entry.source, entry.sourceReadme),
      'utf8'
    );
  }
  const readme = renderReadme({
    name: frontmatter.name,
    description: frontmatter.description,
    sourcePath: entry.source,
    version,
    buildDate,
    gitSha,
    sourceReadmeContent,
  });
  fs.writeFileSync(path.join(stagingDir, 'README.md'), readme);

  // 6. Per-skill prep hook (e.g. agent bundling).
  if (entry.prep) {
    const run = await loadPrep(entry.prep);
    run({ repoRoot, stagingDir });
  }

  // 7. Pack.
  const outputZip = path.join(distRoot, `${entry.name}-v${version}.zip`);
  fs.rmSync(outputZip, { force: true });
  pack({ stagingDir, outputZip });

  return { name: entry.name, zip: path.relative(repoRoot, outputZip) };
}

async function main() {
  validateManifest(MANIFEST, repoRoot);

  const ctx = {
    repoRoot,
    version: readVersion(),
    buildDate: new Date().toISOString().slice(0, 10),
    gitSha: readGitSha(),
    distRoot: path.join(repoRoot, 'dist', 'web-skills'),
  };

  fs.mkdirSync(ctx.distRoot, { recursive: true });

  const results = [];
  for (const entry of MANIFEST) {
    process.stdout.write(`Building ${entry.name}... `);
    const r = await buildOne(entry, ctx);
    process.stdout.write(`✔ ${r.zip}\n`);
    results.push(r);
  }

  console.log('');
  console.log(`Built ${results.length} zip(s) for v${ctx.version} (${ctx.gitSha}, ${ctx.buildDate})`);
  for (const r of results) console.log(`  ${r.zip}`);
}

main().catch(err => {
  console.error(`\nBuild failed: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
