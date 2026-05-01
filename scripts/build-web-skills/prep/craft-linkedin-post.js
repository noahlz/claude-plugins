/**
 * Per-skill prep hook for `craft-linkedin-post`.
 *
 * Bundles the linkedin-reviewer agent into `agents/` and patches SKILL.md with
 * an adapter section, so that on claude.ai web (no Task/subagent dispatch)
 * Claude reads the bundled file inline instead of trying to dispatch it.
 *
 * Mirrors anthropics/skills/skill-creator: bundled agents live under `agents/`,
 * have no YAML frontmatter, and are referenced from SKILL.md by relative path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { stripFrontmatter } from '../clean-frontmatter.js';

const AGENT_SOURCE = 'plugins/writing-tools/agents/linkedin-reviewer.md';
const ADAPTER_SECTION = `
## Bundled agent: linkedin-reviewer

When this workflow says "Dispatch \`linkedin-reviewer\`", read \`agents/linkedin-reviewer.md\` in this skill folder and apply the criteria there yourself. (On Claude Code, this is a separate subagent dispatch; on claude.ai web, you act as the reviewer using those instructions.)
`;

export function run({ repoRoot, stagingDir }) {
  const srcPath = path.join(repoRoot, AGENT_SOURCE);
  let agentBody = stripFrontmatter(fs.readFileSync(srcPath, 'utf8')).trimEnd();

  if (!agentBody.startsWith('#')) {
    agentBody = `# LinkedIn Reviewer\n\n${agentBody}`;
  }

  const destAgentPath = path.join(stagingDir, 'agents', 'linkedin-reviewer.md');
  fs.mkdirSync(path.dirname(destAgentPath), { recursive: true });
  fs.writeFileSync(destAgentPath, agentBody + '\n');

  const skillMdPath = path.join(stagingDir, 'SKILL.md');
  const existing = fs.readFileSync(skillMdPath, 'utf8');
  fs.writeFileSync(skillMdPath, existing.trimEnd() + '\n' + ADAPTER_SECTION);
}
