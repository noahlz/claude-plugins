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
import { cleanFrontmatter, stripFrontmatter } from './clean-frontmatter.js';
import { replaceAgentDispatch } from './replace-agent-dispatch.js';
import { renderReadme } from './render-readme.js';
import { pack } from './pack.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

function readGitSha() {
  // CI provides GITHUB_SHA; trust that over a local git rev-parse.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const full = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    return full.slice(0, 7);
  } catch {
    return 'unknown';
  }
}

function buildOne(entry, ctx) {
  const { repoRoot, version, buildDate, gitSha, distRoot } = ctx;
  const stagingDir = path.join(distRoot, entry.name);

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  for (const rel of entry.include) {
    const dest = path.join(stagingDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, entry.source, rel), dest);
  }

  const skillMdPath = path.join(stagingDir, 'SKILL.md');
  const { content: cleanedSkill, frontmatter } = cleanFrontmatter(
    fs.readFileSync(skillMdPath, 'utf8')
  );
  fs.writeFileSync(skillMdPath, replaceAgentDispatch(cleanedSkill));

  if (entry.bundleAgents) {
    for (const rel of entry.bundleAgents) {
      const src = path.join(repoRoot, rel);
      const body = replaceAgentDispatch(
        stripFrontmatter(fs.readFileSync(src, 'utf8')).trimEnd()
      );
      const dest = path.join(stagingDir, 'agents', path.basename(rel));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, body + '\n');
    }
  }

  fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(stagingDir, 'LICENSE'));

  const sourceReadmeContent = entry.sourceReadme
    ? fs.readFileSync(path.join(repoRoot, entry.source, entry.sourceReadme), 'utf8')
    : undefined;
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

  const outputZip = path.join(distRoot, `${entry.name}-v${version}.zip`);
  fs.rmSync(outputZip, { force: true });
  pack({ stagingDir, outputZip });

  return { name: entry.name, zip: path.relative(repoRoot, outputZip) };
}

function main() {
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
    const r = buildOne(entry, ctx);
    process.stdout.write(`✔ ${r.zip}\n`);
    results.push(r);
  }

  console.log('');
  console.log(`Built ${results.length} zip(s) for v${ctx.version} (${ctx.gitSha}, ${ctx.buildDate})`);
  for (const r of results) console.log(`  ${r.zip}`);
}

// Only run main() when invoked directly as a CLI — not when imported by tests.
const isMain = process.argv[1]
  && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`\nBuild failed: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}
