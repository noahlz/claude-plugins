import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderReadme } from '../../scripts/build-web-skills/render-readme.js';

const baseInputs = {
  name: 'de-llm',
  description: 'Strip AI-telltale patterns from prose.',
  sourcePath: 'plugins/writing-tools/skills/de-llm',
  version: '0.11.1',
  buildDate: '2026-04-30',
  gitSha: 'abc1234',
};

describe('renderReadme', () => {
  it('renders attribution header with name as title', () => {
    const out = renderReadme(baseInputs);
    assert.match(out, /^# de-llm\n/);
  });

  it('includes the description verbatim', () => {
    const out = renderReadme(baseInputs);
    assert.ok(out.includes('Strip AI-telltale patterns from prose.'));
  });

  it('links to author and source repo', () => {
    const out = renderReadme(baseInputs);
    assert.ok(out.includes('[@noahlz](https://github.com/noahlz)'));
    assert.ok(out.includes('https://github.com/noahlz/claude-plugins'));
    assert.ok(out.includes('plugins/writing-tools/skills/de-llm'));
    assert.ok(out.includes('v0.11.1'));
  });

  it('includes build date and short git sha', () => {
    const out = renderReadme(baseInputs);
    assert.ok(out.includes('2026-04-30'));
    assert.ok(out.includes('abc1234'));
  });

  it('mentions MIT license and points to the bundled LICENSE file', () => {
    const out = renderReadme(baseInputs);
    assert.match(out, /MIT — see `LICENSE` in this archive/);
  });

  it('omits the "About this skill" section when no source readme provided', () => {
    const out = renderReadme(baseInputs);
    assert.doesNotMatch(out, /## About this skill/);
  });

  it('folds source readme content under "About this skill" when provided', () => {
    const sourceReadmeContent = '# tighten\n\nDescribes usage.\n';
    const out = renderReadme({ ...baseInputs, sourceReadmeContent });
    assert.match(out, /## About this skill/);
    assert.ok(out.indexOf('## About this skill') < out.indexOf('Describes usage.'));
  });

  it('strips a leading H1 heading from folded source readme to avoid duplicate titles', () => {
    const sourceReadmeContent = '# tighten\n\nUsage paragraph.\n';
    const out = renderReadme({ ...baseInputs, sourceReadmeContent });
    // The original "# tighten" heading should be gone (would conflict with our top-level title).
    const aboutIdx = out.indexOf('## About this skill');
    const tail = out.slice(aboutIdx);
    assert.doesNotMatch(tail, /^# tighten$/m);
    assert.ok(tail.includes('Usage paragraph.'));
  });
});
