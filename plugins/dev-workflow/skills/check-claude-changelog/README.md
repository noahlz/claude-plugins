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
- `gh` CLI ([install](https://cli.github.com/)) — used to query the GitHub API for changelog commit dates
- `curl` — used to fetch raw changelog content

## Usage

Slash command:

```bash
/check-claude-changelog
```

Or tell Claude: "what's new in Claude Code", "check changelog", "any Claude Code updates", etc.

## How It Works

The Claude Code CHANGELOG.md uses undated version headers (`## 2.1.87`). To determine release dates, the skill queries the GitHub API for commits that touched `CHANGELOG.md` — each commit corresponds to a version release. This avoids relying on the WebFetch tool (which summarizes content) and provides accurate date filtering.

**API calls made:**
1. `gh api repos/anthropics/claude-code/commits?path=CHANGELOG.md` — get commit dates
2. Per matching commit: `gh api repos/anthropics/claude-code/commits/{sha}` — extract version from diff
3. `curl` raw CHANGELOG.md — get full entry text

## Edge Cases

- **No commits in repo**: Shows the 3 most recent Claude Code versions
- **Very old last commit**: Caps at 10 most recent versions
- **Already up to date**: Shows "You're up to date!" message
- **`gh` not installed**: Halts with install instructions
- **GitHub API unavailable**: Halts with network error

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
