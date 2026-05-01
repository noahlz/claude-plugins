/**
 * Clean a SKILL.md (or any markdown file) so that its YAML frontmatter contains
 * only fields supported by claude.ai web skill uploads.
 *
 * Allowlist approach: only `name` and `description` survive. Everything else
 * (Claude-Code-only fields like allowed-tools, argument-hint, model, etc.)
 * is stripped, including any indented list values that follow them.
 *
 * Validates per https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview:
 *  - name: 1–64 chars, lowercase letters/digits/hyphens, no "anthropic"/"claude"
 *  - description: 1–1024 chars, no `<` or `>`
 */

const WEB_ALLOWED_FIELDS = ['name', 'description'];
const NAME_RE = /^[a-z0-9-]{1,64}$/;
const RESERVED_WORDS = ['anthropic', 'claude'];

/**
 * Strip surrounding quotes from a YAML scalar value.
 */
function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the flat key/value pairs of a YAML frontmatter block. Block-list values
 * (subsequent lines starting with whitespace + "-") are consumed but discarded
 * since we only ever read scalar fields from the allowlist; lists only appear
 * in stripped fields like `allowed-tools`.
 *
 * @param {string} block The text between the `---` delimiters (no delimiters).
 * @returns {Record<string, string>} Map of key -> raw scalar value.
 */
function parseFlatYaml(block) {
  const result = {};
  const lines = block.split('\n');

  for (const line of lines) {
    if (line.match(/^\s+-\s/) || line.match(/^\s{2,}\S/)) {
      // Continuation of a list or nested block under the previous key — skip.
      continue;
    }
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    result[key] = unquote(rawValue);
  }

  return result;
}

/**
 * Validate the cleaned frontmatter against claude.ai's published constraints.
 * Throws an Error with a clear message on the first violation found.
 */
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
 * Clean YAML frontmatter for claude.ai web upload.
 *
 * @param {string} markdown Original markdown including frontmatter delimiters.
 * @returns {{ content: string, frontmatter: { name: string, description: string } }}
 *   The cleaned markdown and the parsed allowlisted frontmatter.
 */
export function cleanFrontmatter(markdown) {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fmMatch) {
    throw new Error('cleanFrontmatter: no frontmatter block found at start of file');
  }
  const block = fmMatch[1];
  const body = markdown.slice(fmMatch[0].length);

  const parsed = parseFlatYaml(block);
  const cleaned = {};
  for (const key of WEB_ALLOWED_FIELDS) {
    if (parsed[key] !== undefined) cleaned[key] = parsed[key];
  }
  validate(cleaned);

  const fmLines = WEB_ALLOWED_FIELDS
    .filter(k => cleaned[k] !== undefined)
    .map(k => `${k}: ${cleaned[k]}`);
  const content = `---\n${fmLines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`;

  return { content, frontmatter: cleaned };
}
