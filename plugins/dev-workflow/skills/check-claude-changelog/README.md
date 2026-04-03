# Check Changelog

Check the Claude Code changelog for updates since your last commit, with relevance scoring for your specific project.

## What It Does

Fetches the Claude Code changelog, maps version headers to release dates via the GitHub API, filters to versions released since your last commit, then ranks entries by relevance to your project's configuration (CLAUDE.md, hooks, settings, project type).

## Prerequisites

- `node` version 22+
- `curl` — used to fetch changelog content and query the GitHub API

## Usage

```bash
/check-claude-changelog
/check-claude-changelog since 2.1.80
```

The `since <version>` argument shows changes since a specific version instead of since your last commit date. When omitted, defaults to changes since your last git commit.

Or tell Claude: "what's new in Claude Code", "check changelog", "any Claude Code updates", etc.

## How It Works

The Claude Code CHANGELOG.md uses undated version headers. To determine release dates, the skill queries the GitHub API for commits that touched `CHANGELOG.md`. When `since <version>` is used, only the raw changelog is fetched — versions are parsed from headers directly, skipping the commit API.

## Edge Cases

- **No commits in repo**: Shows the 3 most recent Claude Code versions
- **Very old last commit**: Caps at 10 most recent versions
- **Already up to date**: Shows "You're up to date!" message
- **GitHub API unavailable**: Halts with network error