# Parse Changelog Reference

## Input Variables

- `CHANGELOG_RAW` — full raw text of the CHANGELOG.md
- `VERSION_DATES` — array of `{ version, date, dateShort }` objects from `fetch-changelog.js`, pre-filtered to versions released since the last commit

## Instructions

Parse `CHANGELOG_RAW` to extract detailed entries for each version in `VERSION_DATES`.

### Step 1: Extract Version Sections

For each entry in `VERSION_DATES`:
1. Find the line `## {version}` in `CHANGELOG_RAW`
2. Collect all content between that line and the next `## ` line (or end of file)
3. Each bullet point (`- ...`) is one entry

### Step 2: Categorize Entries

Categorize each bullet by inferring the type from its leading verb:
- **Added**: starts with "Added ..."
- **Fixed**: starts with "Fixed ..."
- **Changed**: starts with "Changed ...", "Improved ...", "Reduced ...", "Increased ..."
- **Removed**: starts with "Removed ...", "Deprecated ..."
- **Other**: anything else (platform-specific tags like `[VSCode]` count as the verb category)

### Step 3: Flag High-Interest Items

Flag entries that mention any of these Claude Code plugin/skill development concepts:
- hooks, skills, rules, output styles
- settings, environment variables, managed settings
- slash commands, MCP servers, MCP OAuth
- plugins, agent teams, permissions
- context window, memory, CLAUDE.md
- WebFetch, Bash tool, Read/Edit/Write tools
- worktrees, background agents, tasks

### Step 4: Set Output Variable

Set `CHANGELOG_ENTRIES` to an array of objects:

```
[
  {
    "version": "2.1.87",
    "date": "2026-03-29",
    "categories": {
      "Added": ["entry 1", "entry 2"],
      "Fixed": ["entry 3"],
      "Changed": ["entry 4"]
    },
    "highInterest": ["entry 1", "entry 3"]
  }
]
```

Preserve the order from `VERSION_DATES` (newest first).

→ Return to SKILL.md with `CHANGELOG_ENTRIES` set.
