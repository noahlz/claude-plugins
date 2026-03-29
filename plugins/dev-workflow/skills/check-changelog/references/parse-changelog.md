# Parse Changelog Reference

## Input Variables

- `CHANGELOG_RAW` — full text of the CHANGELOG.md fetched via WebFetch
- `LAST_COMMIT_DATE_SHORT` — YYYY-MM-DD date string of the last commit

## Instructions

Parse `CHANGELOG_RAW` to extract version entries released after `LAST_COMMIT_DATE_SHORT`.

### Step 1: Extract Version Headers

Identify lines matching the pattern: `## [version] - YYYY-MM-DD` (or similar variations like `## version (YYYY-MM-DD)`).

For each header, extract:
- **version**: the version string
- **date**: the release date (YYYY-MM-DD)

### Step 2: Filter by Date

Keep only versions where `date >= LAST_COMMIT_DATE_SHORT`.

If no versions match, set `CHANGELOG_ENTRIES` to empty array and return to SKILL.md.

Cap at **10 most recent versions** if more than 10 match (oldest are dropped).

### Step 3: Extract Categorized Entries

For each matching version, extract entries grouped by category headers (e.g., `### Added`, `### Fixed`, `### Changed`, `### Deprecated`, `### Removed`, `### Security`).

Each entry is a bullet point under a category.

### Step 4: Flag High-Interest Items

While extracting, flag entries that mention any of these Claude Code concepts:
- hooks, skills, rules, output styles
- settings, environment variables
- slash commands, MCP servers
- plugins, agent teams, permissions
- context window, memory, CLAUDE.md

### Step 5: Set Output Variable

Set `CHANGELOG_ENTRIES` to an array of objects:

```
[
  {
    "version": "1.2.3",
    "date": "2025-06-15",
    "categories": {
      "Added": ["entry 1", "entry 2"],
      "Fixed": ["entry 3"]
    },
    "highInterest": ["entry 1", "entry 3"]
  }
]
```

→ Return to SKILL.md with `CHANGELOG_ENTRIES` set.
