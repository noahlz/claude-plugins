---
name: check-claude-changelog
description: Check Claude Code changelog for updates since your last commit. Use when the user wants to see what changed in Claude Code.
model: sonnet
allowed-tools:
  - Bash(node *)
  - Bash(git *)
  - Bash(curl *)
  - Read
  - Grep
  - Glob

---

Check for Claude Code updates relevant to the current project.

Activate only on `/check-claude-changelog` or explicit request about Claude Code updates.

## Arguments

Optional: `since <version>` — show changes since a specific version (e.g. `/check-claude-changelog since 2.1.50`).

When no argument is provided, defaults to showing changes since the last git commit date.

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

**VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

**Node.js Check**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-node-version.js"`

**HALT** if Node.js Check shows `ERROR`.

## Rules

| Rule | Behavior |
|------|----------|
| DELEGATE_TO | Read the referenced file, execute its instructions, return here. |
| Narration | Narrate only STEP_DESCRIPTION steps; all others silent. |
| Script output | Scripts return JSON: `status` ("success" or "error"), `data` or `message`. |

---

# Workflow

## 0. Parse Arguments

If `since <version>` argument found (must match `\d+\.\d+\.\d+`): set `sinceVersion`, skip Step 1, proceed to Step 2.

Otherwise: proceed to Step 1.

## 1. Get Last Commit Date

**STEP_DESCRIPTION**: "Checking last commit date"

Run: `git log -1 --format="%aI %h %s" HEAD`

If the repo has commits: note the ISO date, short date, short SHA, and subject.

If no commits: default to 30 days ago. Note "No commits found — showing recent versions."

## 2. Fetch Changelog

**STEP_DESCRIPTION**: "Fetching Claude Code changelog"

If `sinceVersion` is set:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/fetch-changelog.js" --since-version "{{sinceVersion}}"
```

Otherwise:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/fetch-changelog.js" --since "{{last_commit_date}}"
```

On success: the script writes the full changelog to a temp file. Use the Read tool on the `changelogFile` path from the JSON output to get the content. **DO NOT** fetch the changelog again — use this file for all subsequent steps.

On error: **HALT** and display the error to the user.

## 3. Parse and Filter Changelog Entries

If no new versions found and commits exist: skip to Step 6 with "You're up to date!"

DELEGATE_TO: `references/parse-changelog.md`

## 4. Gather Project Context

**STEP_DESCRIPTION**: "Scanning project for Claude Code usage patterns"

Run these Glob checks:

1. `**/CLAUDE.md` — project instructions
2. `~/.claude/settings.json` — user-level settings and hooks
3. `.claude/settings.json` — project-level settings and hooks
4. `.claude/hooks/**` — hook scripts
5. `**/agents/**/*.md` — agent definitions
6. `**/skills/**/SKILL.md` — skill definitions
7. `.claude/mcp*.json` or `mcp*.json` — MCP server configs

Read each match (note existence for large files). Build a brief summary of Claude Code usage — this informs Step 5.

## 5. Assess Relevance

DELEGATE_TO: `references/assess-relevance.md`

## 6. Present Results

**STEP_DESCRIPTION**: "Presenting Claude Code updates"

Present a compact summary table followed by actionable suggestions.

Format:

```
## Summary of Changes to Claude Code since [version]

Versions X.Y.Z – A.B.C

| Area | Change | Version |
|------|--------|---------|
| Hooks | Conditional `if` field for filtering | 2.1.85 |
| ... | ... | ... |

### Actionable Items

- Update hooks to use `if` conditions for filtering (2.1.85)
- ...
```

**Table rules**: Group by area, not version. No explanations in table cells.

**Actionable Items**: Concrete suggestions for this project, version in parentheses. Only items relevant to Step 4 context.

Do NOT list the full changelog version-by-version.

If no commits were found, note that you're showing recent versions as a fallback.
If no actionable items were identified, say so.

Always end with: `[Full changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)`
