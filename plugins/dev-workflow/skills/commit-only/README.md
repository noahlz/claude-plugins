# Commit Only

Commit staged changes with an AI-generated message. No cost metrics attached.

## What It Does

Using this skill, Claude:

- Detects an existing draft from `/preview-commit-message` (if present), or stages and generates a new message
- Presents the proposed message for approval
- Creates the git commit on approval

## Usage

Slash command:

```bash
/commit-only
```

Or tell Claude: "commit", "commit my changes", "just commit", "commit without costs", etc.

## Workflow with preview-commit-message

You can chain skills for a review-then-commit flow:

1. `/preview-commit-message` — review the generated message
2. `/commit-only` — commit using the already-generated message (skips regeneration)

## Shared References

This skill uses shared reference files located in `plugins/dev-workflow/references/`:

| Reference | Purpose |
|-----------|---------|
| `stage_and_analyze.md` | Stage changes and analyze diff |
| `message_guidelines.md` | Commit message format and conventions |
| `message_approval.md` | Display message and obtain user approval |

## Related Skills

- [`preview-commit-message`](../preview-commit-message/README.md) - Preview a commit message without committing
- [`commit-with-costs`](../commit-with-costs/README.md) - Full commit workflow with cost metrics and approval

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
