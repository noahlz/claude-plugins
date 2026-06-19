import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const skillDir = path.join(repoRoot, 'plugins', 'writing-tools', 'skills', 'de-llm');
const patternsMd = readFileSync(path.join(skillDir, 'references', 'patterns.md'), 'utf8');
const skillMd = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');

/** Extract the `## 12.` section up to the next `## ` heading. */
function pattern12Section(text) {
  const start = text.indexOf('## 12.');
  assert.ok(start !== -1, 'Pattern 12 heading missing from patterns.md');
  const rest = text.slice(start);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

const BLACKLIST = [
  'shape', 'tension', 'boundary', 'unlock', 'gate',
  'weave', 'woven', 'tapestry', 'interplay', 'surface', 'guardrail', 'moat',
  'spine', 'load-bearing',
];

describe('de-llm Pattern 12 metaphor blacklist', () => {
  const section = pattern12Section(patternsMd);

  for (const word of BLACKLIST) {
    it(`Pattern 12 names blacklist word: ${word}`, () => {
      assert.match(section, new RegExp(`\\b${word}\\b`, 'i'),
        `"${word}" missing from Pattern 12 in patterns.md`);
    });
  }

  it('Pattern 12 carries the zero-tolerance delete directive', () => {
    assert.match(section, /zero tolerance/i,
      'blacklist callout missing the zero-tolerance framing');
    assert.match(section, /delete the (rhetorical )?phrasing/i,
      'blacklist must instruct deletion when the referent is unrecoverable');
  });

  it('Pattern 12 still preserves literal technical uses', () => {
    assert.match(section, /[Ll]iteral exceptions/,
      'blacklist must spell out literal-use exceptions');
  });

  it('SKILL.md pre-scan row names the blacklist', () => {
    const row12 = skillMd.split('\n').find(l => /^\|\s*12\s*\|/.test(l));
    assert.ok(row12, 'pre-scan row 12 missing from SKILL.md');
    assert.match(row12, /blacklist/i, 'pre-scan row 12 must name the blacklist');
    for (const word of ['shape', 'tension', 'unlock', 'gate']) {
      assert.match(row12, new RegExp(word, 'i'),
        `pre-scan row 12 should list "${word}"`);
    }
  });
});
