---
name: changelog-update
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

Use this skill to inspect commits since the last release and compose changelog entries that match the project's existing changelog format.

**MANDATORY** only activate this skill when the user invokes it directly (`/changelog-update`) OR asks to update their changelog.

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

**Use this copyable checklist to ensure you follow ALL steps of this skill workflow:**

```
- [ ] 0. Config check
- [ ] 1. Detect latest tag
- [ ] 2. Collect commits
- [ ] 3. Read existing changelog
- [ ] 4. Filter and categorize (silent LLM step)
- [ ] 5. Ask user what to do
- [ ] 6. Write changelog
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Narration Control

**SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently — no explanatory text.

### B. Format Fidelity

This skill does NOT impose any changelog format. It detects and matches whatever format the existing changelog uses — whether that is Keep a Changelog, a custom format, or anything else. Never substitute a different format.

---

# Skill Workflow Instructions

## 0. Config Check

**SKILL_CONFIG**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.changelog-update.json"`

**Configuration routing:**
- If `SKILL_CONFIG` = `✓ Configuration found` → Run `cat .claude/settings.plugins.changelog-update.json`, extract `changelogPath`, store as CHANGELOG_PATH. Verify the file exists with `git ls-files --error-unmatch "{{CHANGELOG_PATH}}" 2>/dev/null || test -f "{{CHANGELOG_PATH}}"`. If missing, use AskUserQuestion: "The configured changelog path `{{CHANGELOG_PATH}}` does not exist. Please provide the correct path (or press Enter for `./CHANGELOG.md`):" — update CHANGELOG_PATH from user response and write updated config.
- If `SKILL_CONFIG` = `NOT_CONFIGURED` → Tell user: "⚠️  Skill configuration not found! (./.claude/settings.plugins.changelog-update.json). Let's create it." Then use AskUserQuestion: "Where is your changelog file? (default: `./CHANGELOG.md`)" — store the answer (or the default if blank) as CHANGELOG_PATH, then write config:
  ```bash
  echo '{"changelogPath":"{{CHANGELOG_PATH}}"}' > .claude/settings.plugins.changelog-update.json
  ```

## 1. Detect Latest Tag

**STEP_DESCRIPTION**: "Detecting latest release tag"

Run:
```bash
git tag --list --sort=-v:refname
```

Scan the output for the most recent semver-like tag. Accepted patterns (in priority order):
- `v1.2.3` / `v1.2.3-rc1`
- `1.2.3`
- `release-1.2.3`
- Any tag whose name contains a sequence of digits separated by dots

Store the matched tag as LATEST_TAG and extract the bare version number (digits and dots only, no prefix) as LATEST_VERSION.

If no semver-like tag is found: inform the user "No release tags found in this repository." and **HALT**.

## 2. Collect Commits

**STEP_DESCRIPTION**: "Collecting commits since last release"

Run:
```bash
git log {{LATEST_TAG}}..HEAD --pretty=format:"%h|%s|%b---END---"
```

If the output is empty (no commits since the tag): inform the user "No changes since {{LATEST_TAG}}." and **HALT**.

Parse the output into individual commit entries, each with:
- `hash` — the short SHA
- `subject` — the commit subject line
- `body` — the commit body (may be empty)

## 3. Read Existing Changelog

**STEP_DESCRIPTION**: "Analyzing existing changelog"

Use the Read tool on CHANGELOG_PATH.

Detect the format/conventions in use:
- Heading style (e.g., `## [1.2.3] - 2024-01-01` vs `# v1.2.3`)
- Bullet style (`-`, `*`, numbered)
- Section names (Added / Changed / Fixed, or custom)
- Date format (ISO, long-form, or absent)

Identify the most recent version entry and its version number. Store as CHANGELOG_LATEST_VERSION.

Compare CHANGELOG_LATEST_VERSION to LATEST_VERSION (the git tag version from Step 1):
- If they **match** → a new version section is needed. Set NEEDS_NEW_VERSION = `true`.
- If they **do not match** → the latest changelog entry is an in-progress / unreleased section. Set NEEDS_NEW_VERSION = `false`.

## 4. Filter and Categorize

This is a pure LLM reasoning step — no tool calls.

Read through all commit entries collected in Step 2 and build a filtered, categorized list of changelog-worthy changes. Do NOT present anything to the user yet.

**Silently drop** commits that are internal-only with no external impact:
- Refactors that do not change behavior or interfaces
- CI/CD pipeline changes
- Dependency version bumps (unless the upgrade brings user-visible behavior changes)
- Code style / formatting / linting changes
- Test-only changes that have no user or developer impact
- Documentation-only changes (unless they document a new feature or API)

**Keep** commits that are user-facing or developer-facing:
- New features or capabilities
- Bug fixes
- API additions, changes, or removals
- Breaking changes
- Deprecations
- Performance improvements with observable impact
- Security fixes
- Documentation of new features

For each kept commit, assign a changelog category based on the format detected in Step 3 (e.g., Added / Changed / Fixed / Removed / Deprecated / Security for Keep a Changelog; or whatever sections the existing file uses).

## 5. Ask User What to Do

**STEP_DESCRIPTION**: "Presenting proposed changelog entries"

Present the filtered and categorized entries to the user, formatted to match the existing changelog's style exactly. Show the entries grouped by category.

Then use AskUserQuestion to confirm the plan:

**If NEEDS_NEW_VERSION = true** (latest tag matches latest changelog entry — a new version section is needed):

Ask: "What version should the new changelog entry be?"

Options:
- `Major ({{NEXT_MAJOR}}.0.0)` — calculate from LATEST_VERSION
- `Minor ({{MAJOR}}.{{NEXT_MINOR}}.0)` — calculate from LATEST_VERSION
- `Patch ({{MAJOR}}.{{MINOR}}.{{NEXT_PATCH}})` — calculate from LATEST_VERSION
- `Use NEXT_RELEASE as placeholder`
- `Let me specify a version`

If user picks "Let me specify a version", use AskUserQuestion to ask for the version string.

**If NEEDS_NEW_VERSION = false** (latest changelog entry is unreleased / in-progress):

Ask: "The latest changelog entry is `{{CHANGELOG_LATEST_VERSION}}` (unreleased). What would you like to do?"

Options:
- `Append entries to {{CHANGELOG_LATEST_VERSION}}`
- `Create a new version section instead`

If user picks "Create a new version section instead", follow up with the major / minor / patch / placeholder question above.

**After the version decision**, ask: "Do the proposed entries look correct, or would you like to make changes?" Give the user a chance to request edits or removals before proceeding. If edits are requested, update the entry list accordingly and confirm again.

## 6. Write Changelog

**STEP_DESCRIPTION**: "Updating changelog"

Use the Edit tool to insert or append entries into CHANGELOG_PATH:

- **If adding a new version section**: insert it after the changelog title/header block and before the previous latest version entry. Match the heading style, date format, and section structure of existing entries exactly.
- **If appending to an existing version section**: add new bullet items under the appropriate section headings within that entry. Do not duplicate entries that already exist.

The written content must match the existing format precisely — heading markers, bullet characters, spacing, section names, and date format. Do NOT introduce any formatting not already present in the file.

After writing, display a brief summary:
- Changelog path updated
- Version entry added or appended
- Number of entries written by category
