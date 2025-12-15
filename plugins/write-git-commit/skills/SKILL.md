---
description: Create git commit with Claude Code cost metrics embedded in footer
capabilities:
  - Calculate cost delta from tracking script
  - Extract session ID from snapshot file
  - Format commit with cost metrics in footer
  - Create git commit with proper structure
---

Activate when user says "commit", "write commit", "create commit", or "git commit". Create git commit with Claude Code cost metrics embedded in footer.

## 1. Calculate Cost Delta

→ Run `./scripts/claude-cost-delta.sh`
→ Capture JSON output: `{"date":"YYYY-MM-DD","delta":{"cost":[[...]]}}`
✓ Delta calculated

## 2. Extract Session ID

→ Read `.claude-cost-snapshot.json`
→ Extract `sessionId` field value
✓ Session ID obtained

## 3. Format Commit Message

→ Ask user for commit subject (brief description)
→ Optionally ask for body (longer explanation)
→ Build HEREDOC structure:

```bash
git commit -m "$(cat <<'EOF'
<subject-line>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"<id>","cost":[{"model":"<model>","tokens":<n>,"cost":<n.nn>}],"date":"YYYY-MM-DD"}
EOF
)"
```

✓ Message formatted

## 4. Create Commit

→ Execute the git commit command
✓ Commit created (exit 0)
✗ Commit failed (exit non-zero)
  → Check `git status` and staging
  → Return to step 3

## 5. Verify

→ Run `git log -1 --format='%B'`
✓ Cost metrics present in footer
✓ `.claude-cost-snapshot.json` updated with new totals
✓ Done

📁 Key files: `.claude-cost-snapshot.json`, `./scripts/claude-cost-delta.sh`
