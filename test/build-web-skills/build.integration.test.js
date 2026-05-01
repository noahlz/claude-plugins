import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const distDir = path.join(repoRoot, 'dist', 'web-skills');
const pkgVersion = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

/** Run `unzip -p <zip> <inner>` and return the file contents. */
function unzipFile(zipPath, innerPath) {
  const r = spawnSync('unzip', ['-p', zipPath, innerPath], { encoding: 'utf8' });
  assert.equal(r.status, 0, `unzip -p failed for ${innerPath}: ${r.stderr}`);
  return r.stdout;
}

/** Run `unzip -Z1 <zip>` and return file list. */
function unzipList(zipPath) {
  const r = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  assert.equal(r.status, 0, `unzip -Z1 failed: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean);
}

describe('build-web-skills end-to-end', () => {
  before(() => {
    rmSync(distDir, { recursive: true, force: true });
    const r = spawnSync('node', ['scripts/build-web-skills/index.js'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(
      r.status, 0,
      `build script exited ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`
    );
  });

  after(() => {
    rmSync(distDir, { recursive: true, force: true });
  });

  it('produces three named zip artifacts', () => {
    const expected = [
      `de-llm-v${pkgVersion}.zip`,
      `craft-linkedin-post-v${pkgVersion}.zip`,
      `tighten-for-llms-v${pkgVersion}.zip`,
    ];
    for (const name of expected) {
      assert.ok(existsSync(path.join(distDir, name)), `expected ${name} to exist`);
    }
  });

  describe('de-llm zip', () => {
    const zip = () => path.join(distDir, `de-llm-v${pkgVersion}.zip`);

    it('contains SKILL.md, LICENSE, README.md, and references/patterns.md', () => {
      const files = unzipList(zip());
      assert.ok(files.includes('de-llm/SKILL.md'));
      assert.ok(files.includes('de-llm/LICENSE'));
      assert.ok(files.includes('de-llm/README.md'));
      assert.ok(files.includes('de-llm/references/patterns.md'));
    });

    it('SKILL.md frontmatter contains only name and description', () => {
      const skillMd = unzipFile(zip(), 'de-llm/SKILL.md');
      const fmMatch = skillMd.match(/^---\n([\s\S]*?)\n---/);
      assert.ok(fmMatch, 'frontmatter missing');
      const fm = fmMatch[1];
      assert.match(fm, /name: de-llm/);
      assert.match(fm, /description:/);
      assert.doesNotMatch(fm, /allowed-tools/);
      assert.doesNotMatch(fm, /argument-hint/);
      assert.doesNotMatch(fm, /user-invocable/);
    });

    it('README.md attributes the source repo and author', () => {
      const readme = unzipFile(zip(), 'de-llm/README.md');
      assert.ok(readme.includes('@noahlz'));
      assert.ok(readme.includes('https://github.com/noahlz/claude-plugins'));
      assert.ok(readme.includes(`v${pkgVersion}`));
    });

    it('LICENSE is the MIT text from repo root', () => {
      const license = unzipFile(zip(), 'de-llm/LICENSE');
      const repoLicense = readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
      assert.equal(license, repoLicense);
    });
  });

  describe('craft-linkedin-post zip', () => {
    const zip = () => path.join(distDir, `craft-linkedin-post-v${pkgVersion}.zip`);

    it('bundles agents/linkedin-reviewer.md', () => {
      const files = unzipList(zip());
      assert.ok(files.includes('craft-linkedin-post/agents/linkedin-reviewer.md'));
    });

    it('bundled agent has no YAML frontmatter', () => {
      const agent = unzipFile(zip(), 'craft-linkedin-post/agents/linkedin-reviewer.md');
      assert.doesNotMatch(agent, /^---\n/);
    });

    it('bundled agent starts with a markdown heading', () => {
      const agent = unzipFile(zip(), 'craft-linkedin-post/agents/linkedin-reviewer.md');
      assert.match(agent, /^# /);
    });

    it('SKILL.md has the bundled-agent adapter section', () => {
      const skillMd = unzipFile(zip(), 'craft-linkedin-post/SKILL.md');
      assert.match(skillMd, /## Bundled agent: linkedin-reviewer/);
      assert.ok(skillMd.includes('agents/linkedin-reviewer.md'));
    });
  });

  describe('tighten-for-llms zip', () => {
    const zip = () => path.join(distDir, `tighten-for-llms-v${pkgVersion}.zip`);
    const sourceReadmePath = path.join(
      repoRoot, 'plugins/dev-workflow/skills/tighten-for-llms/README.md'
    );

    it('README.md folds the source README under "About this skill"', () => {
      const readme = unzipFile(zip(), 'tighten-for-llms/README.md');
      assert.match(readme, /## About this skill/);
      // Read the source README at runtime and assert the folded section
      // contains the source body (with leading H1 stripped). This pins the
      // contract — "fold the source README" — without coupling to specific
      // wording in the source file.
      const source = readFileSync(sourceReadmePath, 'utf8');
      const sourceBody = source.replace(/^# [^\n]*\n+/, '').trim();
      assert.ok(sourceBody.length > 0, 'source README must have a body to fold');
      const aboutIdx = readme.indexOf('## About this skill');
      const folded = readme.slice(aboutIdx);
      assert.ok(
        folded.includes(sourceBody),
        `bundled README should contain the full source body under "About this skill"`
      );
    });

    it('does not include a bare copy of the source README at root', () => {
      // README.md should be the generated attribution one, not the source one.
      const readme = unzipFile(zip(), 'tighten-for-llms/README.md');
      assert.match(readme, /^# tighten-for-llms\n/);
      assert.ok(readme.includes('@noahlz'));
    });
  });
});
