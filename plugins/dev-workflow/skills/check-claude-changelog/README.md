# Check Changelog

Check the Claude Code changelog for updates since your last commit, with relevance scoring for your specific project.

## What It Does

Using this skill, Claude:

- Determines when you last committed to the current repo
- Fetches the Claude Code CHANGELOG.md and maps versions to release dates via the GitHub API
- Filters to versions released since your last commit
- Scans your project for context (CLAUDE.md files, settings, hooks, project type)
- Ranks changelog entries by relevance to your project configuration
- Presents a summary with the most actionable items highlighted

## Prerequisites

- `node` version 22+
- `curl` — used to fetch changelog content and query the GitHub API

## Usage

Slash command:

```bash
/check-claude-changelog
/check-claude-changelog since 2.1.80
```

The `since <version>` argument shows changes since a specific version instead of since your last commit. When omitted, defaults to changes since your last git commit date.

Or tell Claude: "what's new in Claude Code", "check changelog", "any Claude Code updates", etc.

## How It Works

The Claude Code CHANGELOG.md uses undated version headers (`## 2.1.87`). To determine release dates, the skill queries the GitHub API for commits that touched `CHANGELOG.md` — each commit corresponds to a version release. This avoids relying on the WebFetch tool (which summarizes content) and provides accurate date filtering.

**API calls made (all via `curl`):**
1. Raw `CHANGELOG.md` from GitHub — get full entry text (always)
2. `https://api.github.com/repos/anthropics/claude-code/commits?path=CHANGELOG.md` — get commit dates (date-based mode only)
3. Per matching commit: `https://api.github.com/repos/anthropics/claude-code/commits/{sha}` — extract version from diff (date-based mode only)

When `since <version>` is used, only call 1 is made — versions are parsed directly from changelog headers, skipping the commit API entirely.

## Edge Cases

- **No commits in repo**: Shows the 3 most recent Claude Code versions
- **Very old last commit**: Caps at 10 most recent versions
- **Already up to date**: Shows "You're up to date!" message
- **GitHub API unavailable**: Halts with network error

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
