# Changelog Update

Inspect commits since last release and write changelog entries matching your project's existing format.

## What It Does

Detects the latest semver tag, collects commits since that tag, filters out non-user-facing changes (CI, deps, lint, tests, docs), and categorizes the rest into sections matching your existing changelog. Presents proposed entries for review, then writes them using your project's detected format — heading style, bullet characters, section names, and date format are all preserved exactly.

## Prerequisites

- `node` version 22+
- `git` with at least one semver-style tag (`v1.2.3`, `1.2.3`, `release-1.2.3`, etc.)

## Usage

```bash
/update-changelog
```

Or tell Claude: "update changelog", "add changelog entries", "what goes in the changelog since last release", etc.

## How It Works

Reads the existing changelog before writing anything to detect format. When the latest changelog version matches the latest git tag, prompts for the next version (Major, Minor, Patch with computed values, `NEXT_RELEASE`, or custom). When the latest changelog entry is already newer than the latest tag, asks whether to append to that section or create a new versioned section.

## Configuration

On first run, prompts for your changelog file path and writes:

`.claude/settings.plugins.update-changelog.json`

```json
{ "changelogPath": "./CHANGELOG.md" }
```

## Edge Cases

- **No semver tag found** — skill halts with an explanatory message
- **No commits since latest tag** — skill halts: "No changes since `<tag>`"
- **Latest changelog version matches latest tag** — prompts for next version before writing entries