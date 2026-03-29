# Assess Relevance Reference

## Input Variables

- `CHANGELOG_ENTRIES` — parsed changelog entries (array of version objects with categories and highInterest flags)
- `PROJECT_CONTEXT` — project scan results (claudeMdFiles, claudeDir, projectTypes, plugins)

## Instructions

Cross-reference `CHANGELOG_ENTRIES` with `PROJECT_CONTEXT` to identify the most actionable changelog items for this specific project.

### Matching Criteria

Rank each changelog entry by relevance using these signals:

1. **Project Type Alignment**
   - Node.js/npm changes → project has `package.json`
   - Python changes → project has `pyproject.toml` or `setup.py`
   - Rust changes → project has `Cargo.toml`
   - General CLI changes → relevant to all projects

2. **Feature Usage Overlap**
   - Project has `.claude/settings.json` → settings/configuration changes are relevant
   - Project has hooks configured → hook-related changes are relevant
   - Project has plugins installed → plugin system changes are relevant
   - Project has CLAUDE.md files → CLAUDE.md parsing/behavior changes are relevant
   - Project uses MCP servers → MCP changes are relevant

3. **CLAUDE.md Keyword Matching**
   - Scan CLAUDE.md previews for keywords that match changelog entries
   - Examples: mentions of "MCP", "hooks", "rules", specific tool names

4. **High-Interest Flag**
   - Items already flagged as high-interest in `CHANGELOG_ENTRIES` get a relevance boost

### Relevance Levels

- **HIGH**: Direct match between project feature usage and changelog entry (e.g., project uses hooks AND changelog changes hook behavior)
- **MEDIUM**: Indirect match or general improvement that likely affects this project type
- **LOW**: No specific match but still a Claude Code change the user should know about

### Output

Set `ACTIONABLE_ITEMS` to a list of the top items (up to 7), sorted by relevance:

```
[
  {
    "level": "HIGH",
    "version": "1.2.3",
    "entry": "Description of the change",
    "reason": "Why this matters for this project"
  }
]
```

Only include HIGH and MEDIUM items in `ACTIONABLE_ITEMS`. LOW items are shown in the version-by-version listing but not in the "Most Actionable" section.

→ Return to SKILL.md with `ACTIONABLE_ITEMS` set.
