/**
 * Clean SKILL.md YAML frontmatter for claude.ai web upload: only `name` and
 * `description` are kept (claude.ai rejects Claude-Code-only fields like
 * `allowed-tools`, `argument-hint`, `model`).
 *
 * Constraints per https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview:
 *   name: 1–64 chars, lowercase letters/digits/hyphens, no "anthropic"/"claude"
 *   description: 1–1024 chars, no `<` or `>`
 */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const WEB_ALLOWED_FIELDS = ['name', 'description'];
const NAME_RE = /^[a-z0-9-]{1,64}$/;
const RESERVED_WORDS = ['anthropic', 'claude'];

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Block-list values (lines starting with whitespace + "-") are skipped — we
// only read scalars from the allowlist; lists only appear in stripped fields.
function parseFlatYaml(block) {
  const result = {};
  for (const line of block.split('\n')) {
    if (line.match(/^\s+-\s/) || line.match(/^\s{2,}\S/)) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    result[m[1]] = unquote(m[2]);
  }
  return result;
}

function validate({ name, description }) {
  if (!name) {
    throw new Error('cleanFrontmatter: required field "name" is missing or empty');
  }
  if (!NAME_RE.test(name)) {
    throw new Error(
      `cleanFrontmatter: invalid name "${name}" — must be 1–64 chars, lowercase letters/digits/hyphens only`
    );
  }
  for (const word of RESERVED_WORDS) {
    if (name.toLowerCase().includes(word)) {
      throw new Error(
        `cleanFrontmatter: invalid name "${name}" — must not contain reserved word "${word}"`
      );
    }
  }
  if (!description) {
    throw new Error('cleanFrontmatter: required field "description" is missing or empty');
  }
  if (description.length > 1024) {
    throw new Error(
      `cleanFrontmatter: description is ${description.length} chars (max 1024)`
    );
  }
  if (description.includes('<') || description.includes('>')) {
    throw new Error('cleanFrontmatter: description must not contain "<" or ">" characters');
  }
}

/**
 * Remove the leading YAML frontmatter block from a markdown string.
 * Returns the body unchanged if no frontmatter is present.
 */
export function stripFrontmatter(markdown) {
  const m = markdown.match(FRONTMATTER_RE);
  return m ? markdown.slice(m[0].length).replace(/^\n+/, '') : markdown;
}

export function cleanFrontmatter(markdown) {
  const fmMatch = markdown.match(FRONTMATTER_RE);
  if (!fmMatch) {
    throw new Error('cleanFrontmatter: no frontmatter block found at start of file');
  }
  const body = markdown.slice(fmMatch[0].length);

  const parsed = parseFlatYaml(fmMatch[1]);
  const cleaned = {};
  for (const key of WEB_ALLOWED_FIELDS) {
    if (parsed[key] !== undefined) cleaned[key] = parsed[key];
  }
  validate(cleaned);

  const fmLines = WEB_ALLOWED_FIELDS.map(k => `${k}: ${cleaned[k]}`);
  const content = `---\n${fmLines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`;

  return { content, frontmatter: cleaned };
}
