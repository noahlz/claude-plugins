---
name: write-git-commit
description: Create git commit with Claude Code cost metrics embedded in footer. Activate when user says "commit", "write commit", "create commit", or "git commit".
---

## 1. Load Configuration

→ Source: `${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh`
✓ Configuration loaded → `$METRICS_FILE` and `$SESSION_FILTER` available

## 2. Calculate Cost Delta

→ Run: `COST_DELTA=$(${CLAUDE_PLUGIN_ROOT}/scripts/claude-cost-delta.sh "$METRICS_FILE")`
✓ Script outputs JSON cost array: `[{"model":"...","tokens":N,"cost":N.NN}]`
✗ Script fails → Display error and stop

## 3. Get Session ID and Date

→ Extract session ID from current `ccusage` data: `ccusage session --json | jq -r '.sessions[0].sessionId'`
→ Get current date/time in ISO 8601 format: `date -u +%Y-%m-%dT%H:%M:%SZ`

## 4. Get Commit Message

→ Ask user for commit subject (brief, imperative)
→ Optionally ask for body (longer explanation)

## 5. Build Commit Message with Cost Footer

→ Build single-line JSON cost footer:
  `{"sessionId":"<id>","cost":<cost-array>,"date":"<ISO-8601-date>"}`
  - Date format: YYYY-MM-DDTHH:MM:SSZ (ISO 8601)

→ Format full commit message:
```
<subject>

<body (optional)>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
<cost-json-footer>
```

## 6. Show Preview

→ Display formatted commit message to user

→ Use AskUserQuestion:
  - "Proceed with this commit?" (recommended)
  - "No, let me edit the message"
  - "Other"

✓ "Proceed" → Proceed to step 7
✗ "No, let me edit" → Return to step 4

## 7. Create Commit

→ Execute: `git commit -m "..."`
✓ Exit 0 → Commit created, proceed to step 8
✗ Exit non-zero → Display error, return to step 4

## 8. Append to Metrics File

→ Get commit SHA: `COMMIT_SHA=$(git rev-parse HEAD)`
→ Run: `${CLAUDE_PLUGIN_ROOT}/scripts/append-cost-metrics.sh "$METRICS_FILE" "$COMMIT_SHA" "<subject>" "$COST_DELTA"`
✓ Script appends entry to metrics file
✗ Script fails → Display error but continue (commit was created)

## 9. Update .gitignore (Optional)

→ Check if metrics file is in `.gitignore`
✓ Already ignored → Proceed to step 10
✗ Not ignored → Ask user: "Add metrics file to .gitignore?"
  - "Yes" → Add to .gitignore
  - "No" → Continue

## 10. Success

✅ Commit created with cost metrics in footer
✅ Metrics entry appended to historical file
→ Display commit SHA
→ Display metrics file location
✓ Done

🔧 Configuration: `.claude/commit-config.json` (optional)
  - `metricsFile`: Path to metrics file (default: `.claude/cost-metrics.json`)
  - `sessionFilter`: Optional session filter string (default: `null` = use first/most recent session)
    - Example: `"ligeon"` to filter sessions containing "ligeon"
📁 Metrics file: `.claude/cost-metrics.json` (NDJSON, one entry per line)
📁 Scripts used:
  - `claude-cost-delta.sh` - Calculates cost delta from ccusage
  - `append-cost-metrics.sh` - Appends entry to metrics file
