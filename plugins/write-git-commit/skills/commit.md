---
name: commit
description: Create git commit with Claude Code cost metrics
---

# Skill: Write Git Commit with Cost Metrics

Create a git commit with Claude Code cost metrics embedded in the commit footer.

## Prerequisites

- All changes staged: `git add <files>`
- `.claude-cost-snapshot.json` file exists
- `./scripts/claude-cost-delta.sh` script exists and is executable

## Process

1. **Calculate cost delta** by running `./scripts/claude-cost-delta.sh`
2. **Extract session ID** from `.claude-cost-snapshot.json`
3. **Ask user for commit message** (subject and optional body)
4. **Format and create commit** using HEREDOC with cost metrics in footer:

```bash
git commit -m "$(cat <<'EOF'
<Subject line>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"<id>","cost":[{"model":"<model>","tokens":<n>,"cost":<n.nn>}],"date":"YYYY-MM-DD"}
EOF
)"
```

5. **Verify** with `git log -1 --format='%B'`

## Output

Commit created with cost metrics in footer, `.claude-cost-snapshot.json` updated.
