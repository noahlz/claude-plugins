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

    it('SKILL.md body is environment-generic — no $ARGUMENTS or redundant H1', () => {
      const skillMd = unzipFile(zip(), 'de-llm/SKILL.md');
      assert.doesNotMatch(skillMd, /\$ARGUMENTS/);
      assert.doesNotMatch(skillMd, /^# de-llm$/m);
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

    it('SKILL.md references the bundled agent file via the inline-read form', () => {
      const skillMd = unzipFile(zip(), 'craft-linkedin-post/SKILL.md');
      // The web build's agent-dispatch normalizer rewrites
      // "Dispatch the `linkedin-reviewer` agent to ..." into a direct read of
      // the bundled file. The source assertion lives in a separate test below.
      assert.match(
        skillMd,
        /Read `agents\/linkedin-reviewer\.md` and follow its instructions to/
      );
      assert.doesNotMatch(skillMd, /## Bundled agent: linkedin-reviewer/);
      assert.doesNotMatch(skillMd, /Dispatch the/);
      // Step 5's scratch-save line is dropped from source.
      assert.doesNotMatch(skillMd, /scratch[- ]?file|temporary.*location/i);
    });

    it('source SKILL.md uses the canonical "Dispatch the X agent to" form', () => {
      const sourceSkill = readFileSync(
        path.join(repoRoot, 'plugins/writing-tools/skills/craft-linkedin-post/SKILL.md'),
        'utf8'
      );
      assert.match(sourceSkill, /Dispatch the `?linkedin-reviewer`? agent to/);
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

    it('SKILL.md is environment-generic — no $ARGUMENTS, no slash-command gate, no AskUserQuestion in body', () => {
      const skillMd = unzipFile(zip(), 'tighten-for-llms/SKILL.md');
      assert.doesNotMatch(skillMd, /\$ARGUMENTS/);
      assert.doesNotMatch(skillMd, /Only activate when user invokes/);
      // Body (post-frontmatter) should not reference the AskUserQuestion tool name.
      const body = skillMd.replace(/^---\n[\s\S]*?\n---\n/, '');
      assert.doesNotMatch(body, /AskUserQuestion/);
    });

    it('SKILL.md leads with multi-modal input', () => {
      const skillMd = unzipFile(zip(), 'tighten-for-llms/SKILL.md');
      assert.match(skillMd, /attached file/i);
      assert.match(skillMd, /pasted (?:text|block|markdown)/i);
    });
  });
});
