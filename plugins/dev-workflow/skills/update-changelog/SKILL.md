---
name: update-changelog
description: Inspect commits since last release and compose changelog entries. Use when the user wants to update their changelog.
model: sonnet
context: fork
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Edit
  - AskUserQuestion
---

Inspect commits since last release and write changelog entries matching the project's existing format.

**MANDATORY:** Only activate when user invokes `/update-changelog` or explicitly asks to update their changelog. Follow steps EXACTLY.

---

# Workflow Checklist

```
- [ ] 0. Config check
- [ ] 1. Detect latest tag
- [ ] 2. Collect commits
- [ ] 3. Read existing changelog
- [ ] 4. Filter and categorize (silent)
- [ ] 5. Present and confirm
- [ ] 6. Write changelog
```

---

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ If `SKILL_BASE_DIR` shows literal `${CLAUDE_SKILL_DIR}`, halt: "This skill requires Claude Code 2.1.69 or higher."

## Silence Protocol

Only narrate steps with a `STEP_DESCRIPTION`. Execute all other steps and tool calls silently.

## Format Fidelity

Never impose a changelog format. Detect and match whatever format the existing changelog uses.

---

## Step 0 — Config Check

Run: `node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.update-changelog.json"`

- **Found** → run `cat .claude/settings.plugins.update-changelog.json`, extract `changelogPath`, store as `CHANGELOG_PATH`. Verify it exists: `git ls-files --error-unmatch "{{CHANGELOG_PATH}}" 2>/dev/null || test -f "{{CHANGELOG_PATH}}"`. If missing, ask for correct path (default: `./CHANGELOG.md`), update config.
- **NOT_CONFIGURED** → tell user config is missing. Ask: "Where is your changelog file? (default: `./CHANGELOG.md`)" Store response as `CHANGELOG_PATH`. Write config: `echo '{"changelogPath":"{{CHANGELOG_PATH}}"}' > .claude/settings.plugins.update-changelog.json`

## Step 1 — Detect Latest Tag

**STEP_DESCRIPTION**: "Detecting latest release tag"

Run: `git tag --list --sort=-v:refname`

Find the most recent semver-like tag (`v1.2.3`, `1.2.3`, `release-1.2.3`, or any digits-and-dots pattern). Store tag as `LATEST_TAG`; strip prefix to get `LATEST_VERSION`.

No semver tag found → tell user and **HALT**.

## Step 2 — Collect Commits

**STEP_DESCRIPTION**: "Collecting commits since last release"

Run: `git log {{LATEST_TAG}}..HEAD --pretty=format:"%h|%s|%b---END---"`

Empty output → tell user "No changes since {{LATEST_TAG}}." and **HALT**.

Parse into entries with fields: `hash`, `subject`, `body`.

## Step 3 — Read Existing Changelog

**STEP_DESCRIPTION**: "Analyzing existing changelog"

Read `CHANGELOG_PATH`. Detect: heading style, bullet style, section names, date format. Find the most recent version entry → store as `CHANGELOG_LATEST_VERSION`.

- `CHANGELOG_LATEST_VERSION` == `LATEST_VERSION` → `NEEDS_NEW_VERSION = true`
- Otherwise → `NEEDS_NEW_VERSION = false`

## Step 4 — Filter and Categorize

Silent LLM step — no tool calls, no output to user yet.

**Drop** (no external impact): refactors, CI/CD changes, dependency bumps (unless user-visible), style/lint/formatting, test-only, docs-only.

**Keep** (user- or developer-facing): new features, bug fixes, API changes, breaking changes, deprecations, observable perf improvements, security fixes.

Assign each kept commit a category matching the detected format (e.g., Added / Changed / Fixed / Removed / Deprecated / Security).

## Step 5 — Present and Confirm

**STEP_DESCRIPTION**: "Presenting proposed changelog entries"

Show filtered entries grouped by category, formatted to match the existing changelog style exactly.

**If `NEEDS_NEW_VERSION = true`**, ask for the new version:
- `Major ({{NEXT_MAJOR}}.0.0)`
- `Minor ({{MAJOR}}.{{NEXT_MINOR}}.0)`
- `Patch ({{MAJOR}}.{{MINOR}}.{{NEXT_PATCH}})`
- `Use NEXT_RELEASE as placeholder`
- `Let me specify a version`

**If `NEEDS_NEW_VERSION = false`**, ask:
> "The latest changelog entry is `{{CHANGELOG_LATEST_VERSION}}` (unreleased). Append to it, or create a new version section?"

If user wants a new section, follow up with the major/minor/patch question above.

After the version decision, ask: "Do these entries look correct, or would you like changes?" Apply any requested edits and confirm before proceeding.

## Step 6 — Write Changelog

**STEP_DESCRIPTION**: "Updating changelog"

Use Edit to insert or append entries into `CHANGELOG_PATH`:

- **New version section**: insert after the header block, before the previous latest entry.
- **Append to existing section**: add bullets under the appropriate headings; do not duplicate existing entries.

Match format exactly: heading markers, bullet characters, spacing, section names, date format. Do NOT introduce any formatting not already present.

After writing, show a brief summary: path updated, version added/appended, entry count by category.