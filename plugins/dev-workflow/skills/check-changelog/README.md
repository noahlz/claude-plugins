# check-changelog

Check the Claude Code changelog for updates since your last commit, with relevance scoring for your specific project.

## Usage

```
/check-changelog
```

Or ask naturally:
- "What's new in Claude Code?"
- "Check for Claude Code updates"
- "Any changelog updates?"

## What It Does

1. Finds the date of your last git commit
2. Fetches the official Claude Code CHANGELOG.md
3. Filters to versions released since that date
4. Scans your project for context (CLAUDE.md files, settings, hooks, project type)
5. Ranks changelog entries by relevance to your project
6. Presents a summary with the most actionable items highlighted

## Example Output

```
## Claude Code Updates Since 2025-06-01
(Last commit: a1b2c3d — Fix authentication bug)

### 1.5.0 (2025-06-15)
**Added:** Hook pre/post execution events
**Fixed:** Memory persistence across sessions

---

## Most Actionable for This Project

1. **[HIGH]** Hook pre/post execution events → Your project has hooks configured in .claude/settings.json
2. **[MEDIUM]** Memory persistence fix → Your project uses CLAUDE.md files
```

## Edge Cases

- **No commits**: Shows the 3 most recent Claude Code versions
- **Very old last commit**: Caps at 10 most recent versions
- **Already up to date**: Shows "You're up to date!" message
