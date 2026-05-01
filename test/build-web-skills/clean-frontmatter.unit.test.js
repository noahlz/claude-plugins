import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  cleanFrontmatter,
  stripFrontmatter,
} from '../../scripts/build-web-skills/clean-frontmatter.js';

// Mirror constraints in clean-frontmatter.js so boundary tests read as boundaries.
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

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
      // model is not in WEB_ALLOWED_FIELDS, so it's stripped via the allowlist
      // (not a special-case rule); same goes for argument-hint.
      assert.doesNotMatch(content, /argument-hint/);
      assert.doesNotMatch(content, /sonnet/);
    });
  });

  describe('name validation', () => {
    const validateCases = [
      { name: 'valid-name-with-hyphens', ok: true },
      { name: 'name123', ok: true },
      { name: 'a', ok: true },
      { name: 'UPPER', ok: false, expect: /invalid name "UPPER" — must be/, reason: 'uppercase' },
      { name: 'has_underscore', ok: false, expect: /invalid name "has_underscore" — must be/, reason: 'underscore' },
      { name: 'has space', ok: false, expect: /invalid name "has space" — must be/, reason: 'space' },
      { name: 'has.dot', ok: false, expect: /invalid name "has\.dot" — must be/, reason: 'dot' },
      { name: 'a'.repeat(MAX_NAME_LENGTH + 1), ok: false, expect: /invalid name .* — must be/, reason: `>${MAX_NAME_LENGTH} chars` },
      { name: 'anthropic-tool', ok: false, expect: /reserved word "anthropic"/, reason: 'reserved word: anthropic' },
      { name: 'my-claude-thing', ok: false, expect: /reserved word "claude"/, reason: 'reserved word: claude' },
    ];

    for (const { name, ok, expect, reason } of validateCases) {
      it(`${ok ? 'accepts' : `rejects`} name "${name}"${reason ? ` (${reason})` : ''}`, () => {
        const input = wrap([`name: ${name}`, 'description: hi']);
        if (ok) {
          assert.doesNotThrow(() => cleanFrontmatter(input));
        } else {
          // Asserting on the specific message proves the right validation branch fired
          // — a generic `/name/i` would let reserved-word cases pass through the
          // shape-check error message and miss a regression in the reserved-word loop.
          assert.throws(() => cleanFrontmatter(input), expect);
        }
      });
    }
  });

  describe('description validation', () => {
    it('accepts a normal description', () => {
      const input = wrap(['name: x', 'description: A short description.']);
      assert.doesNotThrow(() => cleanFrontmatter(input));
    });

    it(`rejects descriptions over ${MAX_DESCRIPTION_LENGTH} chars`, () => {
      const long = 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1);
      const input = wrap(['name: x', `description: ${long}`]);
      assert.throws(
        () => cleanFrontmatter(input),
        new RegExp(`description is ${MAX_DESCRIPTION_LENGTH + 1} chars`)
      );
    });

    it('rejects descriptions containing < or >', () => {
      const input = wrap(['name: x', 'description: has <xml> tag']);
      assert.throws(() => cleanFrontmatter(input), /must not contain "<" or ">"/);
    });

    it('rejects empty descriptions', () => {
      const input = wrap(['name: x', 'description: ""']);
      assert.throws(() => cleanFrontmatter(input), /required field "description" is missing or empty/);
    });
  });

  describe('missing fields', () => {
    it('throws when name is missing', () => {
      const input = wrap(['description: hi']);
      assert.throws(() => cleanFrontmatter(input), /required field "name" is missing or empty/);
    });

    it('throws when description is missing', () => {
      const input = wrap(['name: x']);
      assert.throws(() => cleanFrontmatter(input), /required field "description" is missing or empty/);
    });

    it('throws when there is no frontmatter block at all', () => {
      assert.throws(() => cleanFrontmatter('# just a body\n'), /no frontmatter block found/);
    });
  });
});

describe('stripFrontmatter', () => {
  it('returns the body without the leading frontmatter block', () => {
    const input = '---\nname: x\ndescription: y\n---\n\n# Heading\n\nbody text\n';
    assert.equal(stripFrontmatter(input), '# Heading\n\nbody text\n');
  });

  it('strips trailing blank lines after the closing delimiter', () => {
    const input = '---\nname: x\n---\n\n\n\nbody\n';
    assert.equal(stripFrontmatter(input), 'body\n');
  });

  it('returns input unchanged when there is no frontmatter', () => {
    const input = '# Just a body\n\nNo frontmatter here.\n';
    assert.equal(stripFrontmatter(input), input);
  });

  it('returns input unchanged when "---" appears mid-document, not at the start', () => {
    const input = '# Heading\n\n---\n\nA horizontal rule, not frontmatter.\n';
    assert.equal(stripFrontmatter(input), input);
  });

  it('handles frontmatter without a trailing newline after the closing delimiter', () => {
    const input = '---\nname: x\n---\nbody-on-next-line';
    assert.equal(stripFrontmatter(input), 'body-on-next-line');
  });
});
