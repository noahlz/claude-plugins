# Write Git Commit Plugin

Create git commits with Claude Code. Automatically embeds session cost metrics in commit footers.

## What It Does

- Analyzes staged changes and creates a descriptive commit message
- Asks you to review the message before committing
- **Automatically embeds Claude Code session cost metrics in commit footers** (Git trailer format)
- Creates commit with proper authorship attribution
- Auto-detects project session from current directory name

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

The plugin auto-detects the session filter from your project directory name. On first run, it will ask you to confirm.

To manually override, create `settings.plugins.write-git-commit.json`:

```json
{
  "sessionFilter": "my-project-name"
}
```

## Prerequisites

- Git repository with staged changes
- **ccusage** - Claude Code usage CLI ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Install: `npm install -g ccusage` or `bun install -g ccusage`
  - The plugin will try to use `ccusage`, `npx ccusage`, or `bunx ccusage` in that order

## Author

[@noahlz](https://github.com/noahlz)
