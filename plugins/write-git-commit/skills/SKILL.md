---
name: write-git-commit
description: Create git commit with Claude Code cost metrics embedded in footer. Activate when user says "commit", "write commit", "create commit", or "git commit".
---

## 1. Load Configuration

→ Run: `source ${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh`
→ Use `$METRICS_FILE` in subsequent steps (set by script to `.claude/cost-metrics.json` by default)
✓ Configuration loaded

## 2. Calculate Cost Delta

→ Run `./scripts/claude-cost-delta.sh`
→ Capture JSON output: `{"date":"YYYY-MM-DD","delta":{"cost":[[...]]}}`
✓ Delta calculated

## 3. Extract Session ID

→ Read `.claude-cost-snapshot.json`
→ Extract `sessionId` field value
✓ Session ID obtained

## 4. Format Commit Message

→ Ask user for commit subject (brief description)
→ Optionally ask for body (longer explanation)
→ Build formatted message:

```
<subject-line>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"<id>","cost":[{"model":"<model>","tokens":<n>,"cost":<n.nn>}],"date":"YYYY-MM-DD"}
```

✓ Message formatted

## 5. Confirm Commit

→ Display formatted commit message preview
→ Use AskUserQuestion with options:
  - Question: "Create commit with this message?"
  - "Yes" (recommended) → Proceed to step 6
  - "No, let me edit" → Return to step 4
  - "Other" → Follow custom instruction

✓ User chose "Yes" → Proceed to step 6
✗ User chose "No, let me edit" → Return to step 4
→ User chose "Other" → Follow their custom instruction

## 6. Create Commit

→ Build HEREDOC structure and execute git commit command
✓ Commit created (exit 0)
✗ Commit failed (exit non-zero)
  → Check `git status` and staging
  → Return to step 4

## 7. Append to Metrics File

→ Create metrics directory if needed: `mkdir -p "$(dirname "$METRICS_FILE")"`
→ Get commit SHA: `SHA=$(git rev-parse HEAD)`
→ Create compact metrics object (single-line JSON):
  `{"commit":"<sha>","subject":"<subject>","cost":[...],"date":"YYYY-MM-DD"}`
→ Append to metrics file (create if not exists)
✓ Metrics appended in compact format

## 8. Check .gitignore

→ Check if metrics file path is in `.gitignore`
✓ Already ignored → proceed to step 9
✗ Not ignored → ask user: "Add `.claude/cost-metrics.json` to .gitignore?"
  → User confirms → add line to `.gitignore`
  → User declines → continue anyway
✓ .gitignore updated or skipped

## 9. Verify

→ Run `git log -1 --format='%B'`
✓ Cost metrics present in commit footer
✓ Metrics appended to `.claude/cost-metrics.json`
✓ `.claude-cost-snapshot.json` updated with new totals
✓ Done

🔧 Configuration: `.claude/commit-config.json` (optional, set `metricsFile` path)
📁 Metrics file: `.claude/cost-metrics.json` (default, appended to)
