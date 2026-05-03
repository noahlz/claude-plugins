/**
 * Web-zip transform: "Dispatch the <name> agent to <verb>"
 *   → "Read `agents/<name>.md` and follow its instructions to <verb>"
 *
 * Source SKILL.md authors write the Claude Code-natural form. claude.ai has no
 * subagent dispatch, so the build rewrites these references to point at the
 * bundled agent file inline. Source can use either `Dispatch the foo agent to`
 * or `` Dispatch the `foo` agent to `` — backticks around the name are optional
 * and re-applied uniformly around `agents/<name>.md` in the output.
 *
 * Sentence-start "Dispatch" is the convention. Lowercase mid-sentence
 * "dispatch" is intentionally not matched.
 */
const PATTERN = /\bDispatch the `?(\S+?)`? agent to\b/g;

export function replaceAgentDispatch(text) {
  return text.replace(PATTERN, 'Read `agents/$1.md` and follow its instructions to');
}
