/**
 * Per-skill prep hook for `craft-linkedin-post`.
 *
 * Bundles the linkedin-reviewer agent into the staging dir under `agents/` and
 * patches the staged SKILL.md so that, on claude.ai web (where Task/subagent
 * dispatch isn't available), Claude knows to read the bundled agent file
 * inline instead of trying to dispatch it.
 *
 * Mirrors anthropics/skills/skill-creator's pattern: bundled agents live under
 * `agents/`, have no YAML frontmatter, and are referenced from SKILL.md by
 * relative path.
 */

import fs from 'node:fs';
import path from 'node:path';

const AGENT_SOURCE = 'plugins/writing-tools/agents/linkedin-reviewer.md';
const ADAPTER_SECTION = `
## Bundled agent: linkedin-reviewer

When this workflow says "Dispatch \`linkedin-reviewer\`", read \`agents/linkedin-reviewer.md\` in this skill folder and apply the criteria there yourself. (On Claude Code, this is a separate subagent dispatch; on claude.ai web, you act as the reviewer using those instructions.)
`;

/**
 * Strip the entire YAML frontmatter block from a markdown string. Returns the
 * body unchanged if there is no frontmatter.
 */
function stripFrontmatter(md) {
  const match = md.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? md.slice(match[0].length).replace(/^\n+/, '') : md;
}

/**
 * @param {object} opts
 * @param {string} opts.repoRoot    Absolute path to repo root.
 * @param {string} opts.stagingDir  Absolute path to this skill's staging dir.
 */
export function run({ repoRoot, stagingDir }) {
  // 1. Read source agent and strip frontmatter (skill-creator pattern).
  const srcPath = path.join(repoRoot, AGENT_SOURCE);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`prep/craft-linkedin-post: agent source not found at ${AGENT_SOURCE}`);
  }
  let agentBody = stripFrontmatter(fs.readFileSync(srcPath, 'utf8')).trimEnd();

  // 2. Ensure a top-level heading so the file reads as a standalone reference.
  if (!agentBody.startsWith('#')) {
    agentBody = `# LinkedIn Reviewer\n\n${agentBody}`;
  }

  // 3. Write to staging/agents/linkedin-reviewer.md.
  const destAgentPath = path.join(stagingDir, 'agents', 'linkedin-reviewer.md');
  fs.mkdirSync(path.dirname(destAgentPath), { recursive: true });
  fs.writeFileSync(destAgentPath, agentBody + '\n');

  // 4. Append adapter section to the staged SKILL.md.
  const skillMdPath = path.join(stagingDir, 'SKILL.md');
  const existing = fs.readFileSync(skillMdPath, 'utf8');
  const patched = existing.trimEnd() + '\n' + ADAPTER_SECTION;
  fs.writeFileSync(skillMdPath, patched);

  // 5. Sanity-check that the SKILL.md still references the agent.
  if (!patched.includes('linkedin-reviewer')) {
    throw new Error(
      'prep/craft-linkedin-post: staged SKILL.md no longer references "linkedin-reviewer" — bundled agent would be orphaned'
    );
  }
}
