# Write Git Commit with Cost Metrics

Create git commits with Claude Code with attribution and cost-tracking trailers.

## What It Does

Using this skill, Claude:

- Analyzes staged changes and creates a descriptive commit message
- Automatically embeds Claude Code attribution and session cost metrics as [Git trailers](https://git-scm.com/docs/git-interpret-trailers)

## Prerequisites

- `node` version 22+

## Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

## Usage

Slash command:

```bash
/write-git-commit
```

Or tell Claude: "commit", "write commit", "create commit", "git commit", etc.

## Cost Metrics in Commits

The plugin automatically includes session cost metrics in each commit footer using Git trailer format:

```
Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: {"sessionId":"...","cost":[{"model":"...","inputTokens":N,"outputTokens":N,"cost":N.NN}]}
```

Example command that extracts cost metrics from git to a jsonl format: 

```bash
git log --format="{\"sha\":\"%h\", \"cost\":%(trailers:key=Claude-Cost-Metrics,valueonly,separator=%x09)"
```

## Recommended Setup

Add the following to your project's `.claude/settings.json` (create it if it doesn't exist):

```json
{
  "includeGitInstructions": false
}
```

This disables Claude Code's built-in git commit and PR workflow instructions (introduced in Claude Code 2.1.69), which can conflict with this skill's workflow. Without it, Claude Code's default git instructions may activate before this skill fires.

## Configuration

The skill auto-detects your session ID from the current working directory on first run.

**Session ID format:** Absolute paths are converted by replacing `/` with `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

The skill will verify this session exists in your ccusage data and prompt you to save it.

**Manual configuration:** Create `.claude/settings.plugins.write-git-commit.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

### Finding Your Session ID

On first use, the skill will list all available Claude Code sessions and let you select one, automatically recommending the one closest to your working directory.

**Session IDs** are stored in `~/.claude/projects/`. List them with:
```bash
ls ~/.claude/projects
```

**Alternative:** Install [ccusage CLI](https://ccusage.com/guide/installation) and run:
```bash
ccusage session --json
```

## Known Issues

### Data Loss

By default, Claude logs roll every 30 days. As such, usage cost metrics will appear to decrease periodically.

WORKAROUND: set a larger retention period in global `~/.claude/settings.json`:

```json
{
  "cleanupPeriodDays": 99999
}
```

### SubAgent Sessions

For some reason, `ccusage` tracks all subagent costs with a sessionId named "SubAgent." Fortunately, each cost object has an attribute `projectPath`. This allows us to relate the subagent costs back to the parent project.

## Author

[@noahlz](https://github.com/noahlz)  
[Claude](https://claude.com/product/claude-code)
