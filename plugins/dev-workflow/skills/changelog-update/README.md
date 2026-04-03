# Changelog Update

Inspect commits since last release and write changelog entries matching your project's existing format.

## What It Does

Using this skill, Claude:

- Detects the latest semver tag in the repo and collects all commits since that tag
- Reads the existing changelog to detect format (heading style, bullet style, section names, date format)
- Filters commits silently — dropping CI/CD changes, dependency bumps, style/lint/formatting, test-only, and docs-only commits
- Categorizes kept commits (features, bug fixes, API changes, breaking changes, deprecations, performance, security) to match existing section names
- Presents proposed entries grouped by category for your review and confirmation
- Asks whether to append to an existing unreleased section or create a new versioned section
- Writes the changelog using Edit, matching the existing format exactly — no imposed structure

## Prerequisites

- `node` version 22+
- `git` with at least one semver-style tag (`v1.2.3`, `1.2.3`, `release-1.2.3`, etc.)

## Usage

Slash command:

```bash
/changelog-update
```

Or tell Claude: "update changelog", "add changelog entries", "what goes in the changelog since last release", etc.

## How It Works

**Format detection**: The skill reads your existing changelog before writing anything. It never imposes a format — heading markers, bullet characters, spacing, section names, and date format are all detected and preserved exactly.

**Commit filtering**: Commits are categorized silently into keep/drop. Dropped commits have no user- or developer-facing impact (CI, deps, lint, tests, docs). Kept commits are assigned to categories that match what already exists in your changelog (e.g., `Added`, `Fixed`, `Changed`, `Security`).

**Version selection**: When the latest changelog version matches the latest git tag (`NEEDS_NEW_VERSION = true`), you are prompted to choose the next version:
- Major, Minor, or Patch (with computed values shown)
- `NEXT_RELEASE` as a placeholder
- A custom version you specify

**Unreleased section handling**: When the latest changelog entry is already newer than the latest tag, you choose whether to append entries to that section or create a new versioned section.

## Configuration

On first run, the skill prompts for your changelog file path and writes:

`.claude/settings.plugins.changelog-update.json`

```json
{ "changelogPath": "./CHANGELOG.md" }
```

The default path is `./CHANGELOG.md`. Edit the config file to point to a different location.

## Edge Cases

- **No semver tag found** — skill halts with an explanatory message
- **No commits since latest tag** — skill halts: "No changes since `<tag>`"
- **Latest changelog version matches latest tag** — `NEEDS_NEW_VERSION = true`; you are prompted to choose the next version before entries are written

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)