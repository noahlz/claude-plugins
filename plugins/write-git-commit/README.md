# Write Git Commit Plugin

Create git commits with Claude. Optionally tracks API costs in commit metadata.

## What It Does

- Analyzes staged changes and creates a descriptive commit message
- Asks you to review the message before committing
- Optionally embeds API cost metrics in commit footer
- Creates commit with proper authorship attribution

## Usage

```bash
/commit              # Create a commit
```

Or say: "commit", "write commit", "create commit", "git commit"

Requires: staged changes (`git add <files>`)

## Configuration

The plugin works out of the box. To customize, create `.claude/commit-config.json`:

```json
{
  "metricsFile": ".claude/cost-metrics.json"
}
```

## Prerequisites

- Git repository
- Changes staged for commit

## Author

[@noahlz](https://github.com/noahlz)
