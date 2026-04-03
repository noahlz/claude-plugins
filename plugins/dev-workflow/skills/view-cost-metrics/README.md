# View Cost Metrics

Display current session cost metrics without creating a commit.

## What It Does

Fetches and displays the incremental cost incurred since the last git commit for the current session, broken down by model.

## Prerequisites

- `node` version 22+

## Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

## Usage

```bash
/view-cost-metrics
```

Or ask Claude: "how much has this session cost?", "show me the cost", "current costs", etc.

## Configuration

On first run the skill saves your session ID to `.claude/settings.plugins.view-cost-metrics.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

**Session ID format:** Absolute paths with `/` replaced by `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

## Incremental vs. Cumulative Tracking

| Method | Description |
|--------|-------------|
| `incremental` | Cost since the last git commit. The `since` timestamp shows when that commit was made. |
| `cumulative` | Total cost from session start. Used when no prior commit exists in the session. |

## Per-Commit Cost Methodology

Cost computation follows the same methodology as `commit-with-costs` — see [commit-with-costs README](../commit-with-costs/README.md).