# Commit with Costs

Create git commits with Claude Code attribution and incremental session cost metrics embedded in commit footers.

## What It Does

Using this skill, Claude:

- Analyzes staged changes and creates a descriptive commit message
- Presents the message for user approval before committing
- Embeds Claude Code attribution and session cost metrics as [Git trailers](https://git-scm.com/docs/git-interpret-trailers)

## Prerequisites

- `node` version 22+

## Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

## Usage

Slash command:

```bash
/commit-with-costs
```

Or tell Claude: "commit", "write commit", "create commit", "git commit", etc.

## Cost Metrics in Commits

Each commit footer includes session cost metrics in Git trailer format:

```
Co-Authored-By: Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: {"method":"incremental","sessionId":"...","cost":[{"model":"...","inputTokens":N,"outputTokens":N,"cost":N.NN}],"since":"<ISO timestamp of last commit>"}
```

Extract cost metrics from git history to JSONL:

```bash
git log --format="{\"sha\":\"%h\", \"cost\":%(trailers:key=Claude-Cost-Metrics,valueonly,separator=%x09)"
```

### Incremental vs. Cumulative Tracking

The `method` field in `Claude-Cost-Metrics` indicates how costs were calculated:

| Method | Description |
|--------|-------------|
| `incremental` | Cost incurred **since the last git commit** in this session. Accurate per-commit attribution. |
| `cumulative` | Total session cost from session start. Used as a fallback when no prior commit timestamp is available (e.g., the first commit of a session). |

When `method` is `incremental`, the `since` field contains the ISO timestamp of the previous commit, allowing you to reconstruct cost timelines across commits.

## Recommended Setup

Add the following to your project's `.claude/settings.json` (create if it doesn't exist):

```json
{
  "includeGitInstructions": false
}
```

This disables Claude Code's built-in git commit workflow instructions (introduced in Claude Code 2.1.69), which can conflict with this skill.

## Configuration

On first run the skill auto-detects your session ID from the current working directory and saves it to `.claude/settings.plugins.commit-with-costs.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

**Session ID format:** Absolute paths with `/` replaced by `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

### Finding Your Session ID

On first use the skill lists available sessions and recommends the one closest to your working directory.

List session IDs manually:
```bash
ls ~/.claude/projects
```

Or with the [ccusage CLI](https://ccusage.com/guide/installation):
```bash
ccusage session --json
```

## Known Issues

### SubAgent Sessions

`ccusage` tracks all subagent costs under a sessionId named "SubAgent." Each cost entry includes a `projectPath` attribute used to correlate subagent costs back to the parent project.

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
