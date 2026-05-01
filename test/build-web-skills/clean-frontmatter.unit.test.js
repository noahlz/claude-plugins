import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { cleanFrontmatter } from '../../scripts/build-web-skills/clean-frontmatter.js';

const wrap = (fmLines, body = '# body\n\ntext') =>
  `---\n${fmLines.join('\n')}\n---\n\n${body}\n`;

describe('cleanFrontmatter', () => {
  describe('field stripping', () => {
    it('drops fields not in the web allowlist', () => {
      const input = wrap([
        'name: de-llm',
        'description: Strip AI patterns.',
        'user-invocable: true',
        'argument-hint: "[file-path]"',
        'allowed-tools:',
        '  - Read',
        '  - Edit',
      ]);
      const { content } = cleanFrontmatter(input);
      assert.match(content, /^---\nname: de-llm\ndescription: Strip AI patterns\.\n---\n/);
      assert.doesNotMatch(content, /user-invocable/);
      assert.doesNotMatch(content, /argument-hint/);
      assert.doesNotMatch(content, /allowed-tools/);
      assert.doesNotMatch(content, /^\s*- Read/m);
    });

    it('preserves the body verbatim', () => {
      const body = '# Heading\n\nParagraph with `code` and a [link](https://example.com).\n\n- item 1\n- item 2';
      const input = wrap(['name: x', 'description: y'], body);
      const { content } = cleanFrontmatter(input);
      assert.ok(content.endsWith(body + '\n'));
    });

    it('emits frontmatter in name then description order regardless of input order', () => {
      const input = wrap(['description: y desc', 'name: x-name']);
      const { content } = cleanFrontmatter(input);
      const fm = content.split('---')[1];
      const nameIdx = fm.indexOf('name:');
      const descIdx = fm.indexOf('description:');
      assert.ok(nameIdx >= 0 && descIdx > nameIdx, 'name must precede description');
    });

    it('returns parsed frontmatter alongside content', () => {
      const input = wrap(['name: foo-bar', 'description: A quick brown fox.']);
      const { frontmatter } = cleanFrontmatter(input);
      assert.equal(frontmatter.name, 'foo-bar');
      assert.equal(frontmatter.description, 'A quick brown fox.');
    });

    it('handles single-line list values in stripped fields', () => {
      const input = wrap([
        'name: a',
        'description: b',
        'allowed-tools: Read, WebSearch, WebFetch',
      ]);
      const { content } = cleanFrontmatter(input);
      assert.doesNotMatch(content, /allowed-tools/);
      assert.doesNotMatch(content, /WebSearch/);
    });

    it('strips quoted string values correctly', () => {
      const input = wrap([
        'name: a',
        'description: b',
        'argument-hint: "[file-path | skill-name]"',
        'model: sonnet',
      ]);
      const { content } = cleanFrontmatter(input);
      assert.doesNotMatch(content, /argument-hint/);
      assert.doesNotMatch(content, /sonnet/);
    });
  });

  describe('name validation', () => {
    const validateCases = [
      { name: 'valid-name-with-hyphens', ok: true },
      { name: 'name123', ok: true },
      { name: 'a', ok: true },
      { name: 'UPPER', ok: false, reason: 'uppercase' },
      { name: 'has_underscore', ok: false, reason: 'underscore' },
      { name: 'has space', ok: false, reason: 'space' },
      { name: 'has.dot', ok: false, reason: 'dot' },
      { name: 'a'.repeat(65), ok: false, reason: '>64 chars' },
      { name: 'anthropic-tool', ok: false, reason: 'reserved word: anthropic' },
      { name: 'my-claude-thing', ok: false, reason: 'reserved word: claude' },
    ];

    for (const { name, ok, reason } of validateCases) {
      it(`${ok ? 'accepts' : `rejects`} name "${name}"${reason ? ` (${reason})` : ''}`, () => {
        const input = wrap([`name: ${name}`, 'description: hi']);
        if (ok) {
          assert.doesNotThrow(() => cleanFrontmatter(input));
        } else {
          assert.throws(() => cleanFrontmatter(input), /name/i);
        }
      });
    }
  });

  describe('description validation', () => {
    it('accepts a normal description', () => {
      const input = wrap(['name: x', 'description: A short description.']);
      assert.doesNotThrow(() => cleanFrontmatter(input));
    });

    it('rejects descriptions over 1024 chars', () => {
      const long = 'a'.repeat(1025);
      const input = wrap(['name: x', `description: ${long}`]);
      assert.throws(() => cleanFrontmatter(input), /description/i);
    });

    it('rejects descriptions containing < or >', () => {
      const input = wrap(['name: x', 'description: has <xml> tag']);
      assert.throws(() => cleanFrontmatter(input), /description/i);
    });

    it('rejects empty descriptions', () => {
      const input = wrap(['name: x', 'description: ""']);
      assert.throws(() => cleanFrontmatter(input), /description/i);
    });
  });

  describe('missing fields', () => {
    it('throws when name is missing', () => {
      const input = wrap(['description: hi']);
      assert.throws(() => cleanFrontmatter(input), /name/i);
    });

    it('throws when description is missing', () => {
      const input = wrap(['name: x']);
      assert.throws(() => cleanFrontmatter(input), /description/i);
    });

    it('throws when there is no frontmatter block at all', () => {
      assert.throws(() => cleanFrontmatter('# just a body\n'), /frontmatter/i);
    });
  });
});
