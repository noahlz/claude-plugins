---
name: write-git-commit
description: Create a git commit with Claude Code cost metrics embedded in the commit footer. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

## 1. Prepare Cost Data

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh prepare`
→ Parse JSON output to extract:
  - `SESSION_ID` from `data.session_id`
  - `COST_DELTA` from `data.cost_delta` (JSON array)
  - `ISO_DATE` from `data.iso_date`
  - `METRICS_FILE` from `data.metrics_file`

✓ If status is "success" → Continue to section 2
✗ If status is "error" → Display error message and stop

## 2. Get Commit Message

→ Ask user for commit subject (brief, imperative)
→ Optionally ask for commit body (longer explanation, can be empty)

## 3. Build and Preview Commit Message

→ Run commit-workflow.sh to build message:
```bash
RESPONSE=$(bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh build-message \
  "$COMMIT_SUBJECT" "$COMMIT_BODY" "$SESSION_ID" "$COST_DELTA" "$ISO_DATE")
FULL_MESSAGE=$(echo "$RESPONSE" | jq -r '.data.full_message')
```

→ Display `$FULL_MESSAGE` to user with line breaks preserved

→ Ask user with AskUserQuestion:
  - "Proceed with this commit?" (recommended)
  - "No, let me edit the message"
  - "Other"

✓ "Proceed" → Continue to section 4
✗ "No, let me edit" → Return to section 2
✗ "Other" → User provides custom message, use that for next attempt

## 4. Create Commit

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh create-commit "$FULL_MESSAGE"`
→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 5
✗ If status is "error" → Display error, return to section 2

## 5. Append to Metrics File

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh append-metrics "$COMMIT_SHA" "$COMMIT_SUBJECT" "$COST_DELTA"`

✓ If status is "success" → Display success message, continue to section 6
✗ If status is "error" → Display warning (commit was created), continue to section 6 anyway

## 6. Update .gitignore (Optional)

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh check-gitignore`
→ Parse JSON output to get `METRICS_IGNORED` from `data.ignored`

✓ If `METRICS_IGNORED` is true → Proceed to section 7
✗ If `METRICS_IGNORED` is false → Ask user: "Add metrics file to .gitignore?"
  - "Yes" → Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/commit-workflow.sh add-gitignore` → Proceed to section 7
  - "No" → Proceed to section 7

## 7. Success

→ Display success summary:
```
✅ Commit created with cost metrics in footer
   SHA: <COMMIT_SHA>

✅ Metrics entry appended to historical file
   📁 Location: <METRICS_FILE>

📊 Session metrics:
   ID: <SESSION_ID>
   Cost: <total cost from COST_DELTA>
```

✓ Done - Return to user

---

🔧 Configuration: `.claude/commit-config.json` (optional)
  - `metricsFile`: Path to metrics file (default: `.claude/cost-metrics.json`)
  - `sessionFilter`: Filter sessions by substring (default: `null` = use first/most recent)
    - Example: `"claude-plugins"` to filter sessions containing "claude-plugins"

📁 Scripts used:
  - `commit-workflow.sh` - Master orchestrator (handles all workflow logic)
  - `load-config.sh` - Config loading (sourced by workflow script)
  - `claude-cost-delta.sh` - Cost calculation (called by workflow script)
  - `append-cost-metrics.sh` - Metrics appending (called by workflow script)

📝 Metrics file format: NDJSON (one JSON entry per line, not an array)
