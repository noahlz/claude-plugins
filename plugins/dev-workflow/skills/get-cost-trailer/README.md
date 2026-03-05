# Get Cost Trailer

Display current session cost metrics without creating a commit.

## Terminology

**Terminology note:** ccusage refers to a project directory as a "session" (keyed by its filesystem path). Claude Code calls these "projects" (stored in `~/.claude/projects/`). The skill config field `sessionId` is therefore a project path identifier, not a Claude Code session UUID.

## What It Does

Using this skill, Claude fetches and displays the incremental cost incurred since the last git commit for the current Claude Code session, broken down by model.

## Prerequisites

- `node` version 22+

## Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

## Usage

Slash command:

```bash
/get-cost-trailer
```

Or ask Claude: "how much has this session cost?", "show me the cost", "current costs", etc.

## Output Format

```
Session cost metrics:
   ID: -Users-noahlz-projects-my-project
   Method: incremental (since: 2026-03-05T14:45:22-05:00)

   - claude-sonnet-4-6: 12345 in + 3210 out = $0.42
   - claude-haiku-4-5-20251001: 5000 in + 1000 out = $0.07
```

The `Method` line indicates how costs were calculated:

| Method | Description |
|--------|-------------|
| `incremental` | Cost since the last git commit. The `since` timestamp shows when that commit was made. |
| `cumulative` | Total cost from session start. Used when no prior commit exists in the session. |

## Configuration

On first run the skill saves your session ID to `.claude/settings.plugins.get-cost-trailer.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

**Session ID format:** Absolute paths with `/` replaced by `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
