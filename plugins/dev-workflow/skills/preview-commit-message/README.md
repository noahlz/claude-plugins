# Preview Commit Message

Preview a commit message from staged changes without committing.

## What It Does

Using this skill, Claude:

- Stages all changes with `git add -A`
- Analyzes the diff (or uses existing knowledge of edits made in conversation)
- Generates a commit message following the shared message guidelines
- Displays the proposed message **without committing**

## Usage

Slash command:

```
/preview-commit-message
```

Or tell Claude: "draft a commit message", "write a commit message", "preview a commit message", etc.

## Shared References

This skill uses shared reference files located in `plugins/dev-workflow/references/`:

| Reference | Purpose |
|-----------|---------|
| `stage_and_analyze.md` | Stage changes and analyze diff |
| `message_guidelines.md` | Commit message format and conventions |

## Related Skills

- [`commit-only`](../commit-only/README.md) - Commit staged changes with AI-generated message, no cost metrics
- [`commit-with-costs`](../commit-with-costs/README.md) - Full commit workflow with cost metrics and approval

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
