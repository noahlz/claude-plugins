# View Cost Metrics

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
/view-cost-metrics
```

Or ask Claude: "how much has this session cost?", "show me the cost", "current costs", etc.

## Output Format

First prints the raw JSON from the cost script:

```json
{
  "status": "success",
  "data": {
    "session_id": "-Users-noahlz-projects-my-project",
    "method": "incremental",
    "since": "2026-03-05T14:45:22-05:00",
    "current_cost": [...]
  },
  "message": "Session costs resolved"
}
```

Then prints the formatted summary:

```
📊 Project cost metrics:
   Project: -Users-noahlz-projects-my-project
   Cost since previous commit (since 2026-03-05T14:45:22-05:00):
   Total: $0.49

   - claude-sonnet-4-6: 12345 in + 3210 out = $0.42
   - claude-haiku-4-5-20251001: 5000 in + 1000 out = $0.07
```

The `Method` line indicates how costs were calculated:

| Method | Description |
|--------|-------------|
| `incremental` | Cost since the last git commit. The `since` timestamp shows when that commit was made. |
| `cumulative` | Total cost from session start. Used when no prior commit exists in the session. |

## Configuration

On first run the skill saves your session ID to `.claude/settings.plugins.view-cost-metrics.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

**Session ID format:** Absolute paths with `/` replaced by `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

## Per-Commit Cost Methodology

Cost computation follows the same logic as `commit-with-costs` — see that skill's README for full details. Brief summary:

- **Session isolation:** Session IDs are derived from the working directory path (`pwdToSessionId` in `lib/ccusage-operations.js`), so each git worktree is naturally isolated.
- **Incremental anchoring:** In incremental mode, the cost window opens at the most recent commit with a matching `sessionId` in its `Claude-Cost-Metrics` trailer (`getLastCostCommitDate` in `lib/git-operations.js`).
- **Subagent costs included:** ccusage's recursive glob picks up nested `subagents/agent-*.jsonl` files and deduplicates entries by `messageId:requestId`. See `lib/cost-computation.js#computeCosts`.

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
