# Write Git Commit with Cost Metrics

Create git commits with Claude Code. Automatically embeds attribution and session cost metrics in Git trailers.

## What It Does

- Analyzes staged changes and creates a descriptive commit message
- Automatically embeds Claude Code attribution and session cost metrics as [Git trailers](https://git-scm.com/docs/git-interpret-trailers)

## Usage

```bash
/commit              # Create a commit
```

Or say: "commit", "write commit", "create commit", "git commit"

Requires: staged changes (`git add <files>`)

## Cost Metrics in Commits

The plugin automatically includes session cost metrics in each commit footer using Git trailer format:

```
Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: {"sessionId":"...","cost":[{"model":"...","inputTokens":N,"outputTokens":N,"cost":N.NN}]}
```

**Benefits:**
- Easy to extract from git history: `git log --all --pretty=format:"%b" | grep "Claude-Cost-Metrics:"`
- All data stored in git - no separate metrics files
- Includes model-specific input/output tokens and costs

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

**Finding your session ID:** Run `ccusage session --json` to see all available sessions.

## Prerequisites

- Git repository with staged changes
- **ccusage** - Claude Code usage CLI ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Install: `npm install -g ccusage` or `bun install -g ccusage`
  - The plugin will try to use `ccusage`, `npx ccusage`, or `bunx ccusage` in that order

## Author

[@noahlz](https://github.com/noahlz)
