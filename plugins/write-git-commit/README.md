# Write Git Commit Plugin

Create git commits with Claude Code cost metrics embedded in commit footers.

## Features

- Calculates incremental API costs for each commit using Claude Code cost delta
- Embeds cost metrics as structured JSON in commit footer
- Tracks `sessionId`, model, token count, and USD cost per commit
- Enables historical analysis of computational spend

## Usage

Trigger the skill by saying `/commit` or describing your intent: "commit", "write commit", "create commit", or "git commit".

### Prerequisites

- Changes staged: `git add <files>`
- `.claude-cost-snapshot.json` file exists in your project
- `./scripts/claude-cost-delta.sh` script available

### Workflow

The skill will:
1. Run cost delta script to calculate incremental spend
2. Extract session ID from cost snapshot
3. Ask you for commit subject (and optional body)
4. **Show commit message preview and ask for confirmation** before creating commit
   - You can approve the message and proceed
   - Or go back to edit the subject/body
5. Create commit with cost metrics in footer
6. Verify commit was created successfully

### Commit Format

Commits include a footer with embedded cost metrics:

```
Subject: Update documentation

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"...-session-id","cost":[{"model":"claude-sonnet-4-5-20250929","tokens":5915,"cost":0.18}],"date":"2025-12-12"}
```

## Metrics File

Metrics are also appended to a metrics file (default: `.claude/cost-metrics.json`) for long-term tracking. Each metric entry is appended as a single-line JSON object:

```json
{"commit": "abc123def", "subject": "Update documentation", "cost": [{"model": "claude-sonnet-4-5-20250929", "tokens": 5915, "cost": 0.18}], "date": "2025-12-12"}
{"commit": "def456ghi", "subject": "Add new feature", "cost": [{"model": "claude-sonnet-4-5-20250929", "tokens": 12345, "cost": 0.45}], "date": "2025-12-12"}
```

## Configuration

Default config: `commit-config.json` (in plugin directory)

Override per project by creating `.claude/commit-config.json`:

```json
{
  "metricsFile": ".claude/cost-metrics.json"
}
```

Project config deep-merges with defaults (project values override).

The skill will automatically:
- Load default + project config (deep merge)
- Create the metrics directory if it doesn't exist
- Append new metrics in compact single-line format (not overwrite)
- Check if metrics file is in `.gitignore` and offer to add it if not

## Author

[@noahlz](https://github.com/noahlz)