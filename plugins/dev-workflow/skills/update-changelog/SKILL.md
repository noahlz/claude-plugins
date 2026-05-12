---
name: update-changelog
description: Inspect commits since last release and compose changelog entries. Use when the user wants to update their changelog.
model: sonnet
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Edit
  - AskUserQuestion
---

Write changelog entries for commits since the last release, matching the project's existing format.

Activate only on `/update-changelog` or explicit request. Follow steps EXACTLY.

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

**Silence:** Narrate only `STEP_DESCRIPTION` steps; execute all others silently.
**Format fidelity:** Detect and match the existing changelog's format. Never impose a new one.

---

## Step 0 — Config Check

Run: `node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.update-changelog.json"`

- **Found** → `cat .claude/settings.plugins.update-changelog.json`, extract `changelogPath` as `CHANGELOG_PATH`. Verify with `git ls-files --error-unmatch "{{CHANGELOG_PATH}}" 2>/dev/null || test -f "{{CHANGELOG_PATH}}"`. If missing, ask for correct path (default: `./CHANGELOG.md`) and update config.
- **NOT_CONFIGURED** → say config is missing. Ask: "Where is your changelog file? (default: `./CHANGELOG.md`)" Store as `CHANGELOG_PATH`. Write: `echo '{"changelogPath":"{{CHANGELOG_PATH}}"}' > .claude/settings.plugins.update-changelog.json`

## Step 1 — Detect Latest Tag

**STEP_DESCRIPTION**: "Detecting latest release tag"

Run: `git tag --list --sort=-v:refname`

Find the most recent semver-like tag (`v1.2.3`, `1.2.3`, `release-1.2.3`, or any digits-and-dots pattern). Store as `LATEST_TAG`; strip prefix for `LATEST_VERSION`.

No semver tag → say so and **HALT**.

## Step 2 — Collect Commits

**STEP_DESCRIPTION**: "Collecting commits since last release"

Run: `git log {{LATEST_TAG}}..HEAD --pretty=format:"%h|%s|%b---END---"`

Empty output → say "No changes since {{LATEST_TAG}}." and **HALT**.

Parse into entries: `hash`, `subject`, `body`.

## Step 3 — Read Existing Changelog

**STEP_DESCRIPTION**: "Analyzing existing changelog"

Read `CHANGELOG_PATH`. Detect heading style, bullet style, section names, date format. Store most recent version as `CHANGELOG_LATEST_VERSION`.

- `CHANGELOG_LATEST_VERSION` == `LATEST_VERSION` → `NEEDS_NEW_VERSION = true`
- Else → `NEEDS_NEW_VERSION = false`

## Step 4 — Filter and Categorize

Silent — no tool calls or output.

| Action | Commits |
|--------|---------|
| **Drop** (no external impact) | refactors, CI/CD, dependency bumps (unless user-visible), style/lint/formatting, test-only, docs-only |
| **Keep** (user- or developer-facing) | features, bug fixes, API changes, breaking changes, deprecations, observable perf, security fixes |

Assign each kept commit a category matching the detected format (e.g., Added / Changed / Fixed / Removed / Deprecated / Security).

## Step 5 — Present and Confirm

**STEP_DESCRIPTION**: "Presenting proposed changelog entries"

Show filtered entries grouped by category as plain text, matching the existing style. Do NOT repeat entries inside `AskUserQuestion` options.

**If `NEEDS_NEW_VERSION = false`**, call `AskUserQuestion`:
- Question: `"Latest entry is {{CHANGELOG_LATEST_VERSION}} (unreleased). Append or new section?"`
- Options:
  - `Append` — `"Add bullets to {{CHANGELOG_LATEST_VERSION}}"`
  - `New section` — `"Create a new version section"`

`Append` → skip to approval. `New section` → continue to version question.

**If `NEEDS_NEW_VERSION = true`** (or user chose `New section`), call `AskUserQuestion`:
- Question: `"Which version for the new section?"`
- Options:
  - `Major` — `"{{NEXT_MAJOR}}.0.0"`
  - `Minor` — `"{{MAJOR}}.{{NEXT_MINOR}}.0"`
  - `Patch` — `"{{MAJOR}}.{{MINOR}}.{{NEXT_PATCH}}"`
  - `Placeholder` — `"Use NEXT_RELEASE as the version"`
  - `Custom` — `"Specify a version in chat"`

`Custom` → prompt in plain text for the version string.

**Final approval** — call `AskUserQuestion`:
- Question: `"Approve these entries?"`
- Options:
  - `Approve` — `"Write changelog as shown"`
  - `Revise` — `"Request changes in chat"`

`Revise` → apply edits, re-ask until approved.

## Step 6 — Write Changelog

**STEP_DESCRIPTION**: "Updating changelog"

Use Edit to insert or append entries into `CHANGELOG_PATH`:

| Mode | Placement |
|------|-----------|
| New version section | Insert after the header block, before the previous latest entry |
| Append to existing | Add bullets under the matching headings; no duplicates |

Match format exactly: heading markers, bullets, spacing, section names, date format. No new formatting.

After writing, show a brief summary: path updated, version added/appended, entry count by category.