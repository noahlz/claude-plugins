---
name: write-git-commit
description: Create a git commit with Claude Code cost metrics embedded in the commit footer. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

## 1. Prepare Cost Data

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh prepare`
→ Parse JSON output to extract:
  - `SESSION_ID` from `data.session_id`
  - `COST_DELTA` from `data.cost_delta` (JSON array)
  - `ISO_DATE` from `data.iso_date`
  - `METRICS_FILE` from `data.metrics_file`
  - `HAS_NEGATIVE` from `data.has_negative` (optional)

✓ If status is "success" → Continue to section 2
⚠ If status is "warning" and `has_negative` is true:

→ Display warning to user:
```
⚠️  WARNING: Cost delta calculation detected negative values.

This typically happens when:
  - Claude Code session was restarted between commits
  - Cache was invalidated/rebuilt
  - Multiple sessions are active with the same filter

The raw delta shows:
```

→ Extract models with negative values from `COST_DELTA` and display:
```
<for each model: "  - {model}: {tokens} tokens, ${cost}">
```

→ Use AskUserQuestion to present user with options:
  - "Use partial cost (only positive models)" (recommended if some positive models exist)
  - "Add warning in commit footer (cost data unavailable)"
  - "Skip cost metrics for this commit"
  - "Other"

→ Based on response:
  - **Partial cost**: Set `COST_DELTA_MODE="partial"`, continue to section 1a
  - **Warning**: Set `COST_DELTA_MODE="warning"`, continue to section 1a
  - **Skip metrics**: Set `COST_DELTA_MODE="skip"`, continue to section 2
  - **Other**: Follow user's custom instruction

✗ If status is "error" → Display error message and stop

## 1a. Filter Cost Delta (if partial cost chosen)

→ If `COST_DELTA_MODE` is "partial":
```bash
COST_DELTA=$(echo "$COST_DELTA" | jq '[.[] | select(.tokens >= 0 and .cost >= 0)]')
```

→ If `COST_DELTA_MODE` is "warning":
```bash
COST_DELTA="[]"
COST_DELTA_MODE="warning"
```

→ If filtered/warning `COST_DELTA` is empty, display notice: "No valid cost data available - commit will include cost unavailable message"

→ Continue to section 2

## 2. Generate Suggested Commit Message

→ Generate a suggested commit message based on staged changes:
  - Analyze `git diff --cached` or use heuristics to suggest a message
  - Format: "Action: Brief description" (imperative mood)

→ Display suggested message to user:

```
[blank line]
[suggested message here]
[blank line]
```

→ Ask user with AskUserQuestion:
  - "Accept this message?" (recommended)
  - "Provide your own message"
  - "Stop/Cancel commit"

✓ If "Accept" → Extract `COMMIT_SUBJECT` (first line) and `COMMIT_BODY` (remaining) → Continue to section 3
✗ If "Provide own" → Go to section 2a
✗ If "Stop" → Exit workflow

## 2a. Get Custom Commit Message

→ Ask user to enter their full commit message:
  - Question: "Enter your commit message (first line is subject, additional lines are body)"

→ Parse the input to extract:
  - `COMMIT_SUBJECT` = First line
  - `COMMIT_BODY` = Remaining lines (empty if only subject)

→ Continue to section 3

## 3. Build and Preview Commit Message

→ If `COST_DELTA_MODE` is "skip":
  - Build message without cost footer (just subject/body and Co-Authored line)
  - Display note: "Commit will be created without cost metrics (as requested)"

→ If `COST_DELTA_MODE` is "warning":
  - Build message with empty cost array (signals unavailable in footer)
  - Display note: "Commit will include notice that cost data was unavailable"

→ Otherwise, run commit-workflow.sh to build message:
```bash
RESPONSE=$(bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh build-message \
  "$COMMIT_SUBJECT" "$COMMIT_BODY" "$SESSION_ID" "$COST_DELTA" "$ISO_DATE")
FULL_MESSAGE=$(echo "$RESPONSE" | jq -r '.data.full_message')
```

→ Display the full commit message to user in plain text (with blank lines before and after, no other borders):

```
[blank line]
[FULL_MESSAGE displayed exactly as it will be committed]
[blank line]
```

→ Use AskUserQuestion to ask user to confirm:
  - "Proceed with this commit?" (recommended)
  - "No, let me revise the message"

✓ "Proceed" → Continue to section 4
✗ "No, revise" → Return to section 2

## 4. Create Commit

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh create-commit "$FULL_MESSAGE"`
→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 5
✗ If status is "error" → Display error, return to section 2

## 5. Append to Metrics File

→ If `COST_DELTA_MODE` is "skip":
  - Skip appending to metrics file
  - Display note: "Skipping metrics append (as requested)"
  - Continue to section 6

→ Otherwise, run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh append-metrics "$COMMIT_SHA" "$COMMIT_SUBJECT" "$COST_DELTA"`

✓ If status is "success" → Display success message, continue to section 6
✗ If status is "error" → Display warning (commit was created), continue to section 6 anyway

## 6. Update .gitignore (Optional)

→ If `COST_DELTA_MODE` is "skip":
  - Skip gitignore check (no metrics were appended)
  - Continue to section 7

→ Otherwise, run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh check-gitignore`
→ Parse JSON output to get `METRICS_IGNORED` from `data.ignored`

✓ If `METRICS_IGNORED` is true → Proceed to section 7
✗ If `METRICS_IGNORED` is false → Ask user: "Add metrics file to .gitignore?"
  - "Yes" → Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/scripts/commit-workflow.sh add-gitignore` → Proceed to section 7
  - "No" → Proceed to section 7

## 7. Success

→ If `COST_DELTA_MODE` is "skip":
  - Display success summary:
```
✅ Commit created successfully
   SHA: <COMMIT_SHA>

⚠️  Cost metrics were not recorded (skipped per user request)
```

→ Otherwise, display success summary:
```
✅ Commit created with cost metrics in footer
   SHA: <COMMIT_SHA>

✅ Metrics entry appended to historical file
   📁 Location: <METRICS_FILE>

📊 Session metrics:
   ID: <SESSION_ID>
   Cost: <total cost from COST_DELTA> (or "unavailable" if empty)
```

✓ Done - Return to user

---

🔧 Configuration: `.claude/commit-config.json` (optional)
  - `metricsFile`: Path to metrics file (default: `.claude/cost-metrics.jsonl`)
  - `sessionFilter`: Filter sessions by substring (default: `null` = use first/most recent)
    - Example: `"claude-plugins"` to filter sessions containing "claude-plugins"

📁 Scripts used:
  - `commit-workflow.sh` - Master orchestrator (handles all workflow logic)
  - `load-config.sh` - Config loading (sourced by workflow script)
  - `claude-cost-delta.sh` - Cost calculation (called by workflow script)
  - `append-cost-metrics.sh` - Metrics appending (called by workflow script)

📝 Metrics file format: NDJSON (one JSON entry per line, not an array)
