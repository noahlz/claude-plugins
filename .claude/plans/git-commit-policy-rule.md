# Plan: Git Commit Policy Rule

**Project:** claude-code-config
**Purpose:** Move the "no git commands" policy from a memory file + superpowers reference into a proper global rule that's always loaded, with an explicit exception for commit skills.

## Problem

The current git commit prohibition lives in two places:
- `references/superpowers.md` hard constraint #1: "NEVER run `git commit`"
- A memory file in claude-plugins (being removed separately)

Neither place explicitly exempts commit skills (`commit-with-costs`, `commit-only`). When those skills run in `context: fork` with `model: sonnet`, the forked model sees the blanket prohibition and refuses to run `git commit`, breaking the skill workflow.

## Changes

### 1. Create `rules/git-commits.md`

```markdown
# Git Commit Policy

Do NOT run `git` commands. The user controls all git operations.

**Exception:** The `commit-with-costs` and `commit-only` skills may run git commands as part of their defined workflow when invoked directly by the user.

This applies everywhere:
- Main conversation
- Subagents and spawned agents
- Plan execution steps

When writing plans, omit git/commit steps entirely or mark them "(user runs manually)."
When dispatching subagents, state "Do NOT run ANY git commands" in the prompt.
```

### 2. Update `references/superpowers.md`

Remove hard constraint #1 ("NEVER run `git commit`..."). The global rule now handles this.

The updated HARD CONSTRAINTS section should be:

```markdown
## HARD CONSTRAINTS

1. **NEVER** enter plan execution mode automatically. Stop and ask first.
2. **NEVER write plan implementation code directly from the main chat.** Use `model: sonnet` or `model: haiku` subagents – reserve `model: opus` for tasks requiring deep architectural understanding or complex debugging.
3. Save plans and specs to `.claude/plans/`. **NOT** to `docs/`.
4. **Only write pseudocode and type signatures in plans.** Not full implementation code.
```

### 3. Create symlink

```bash
ln -s /Users/noahlz/projects/claude-code-config/rules/git-commits.md /Users/noahlz/.claude/rules/git-commits.md
```

Or run `install.sh` if it handles symlink creation.

## Post-change verification

- Start a new Claude Code session in claude-plugins
- Run `/commit-with-costs` or `/commit-only`
- Confirm AskUserQuestion appears for message approval
- Confirm the skill runs `git commit` successfully
