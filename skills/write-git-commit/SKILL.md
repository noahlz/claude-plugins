---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics embedded in the commit footer. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

## 1. Prepare Cost Data

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh prepare`
→ Parse JSON output to extract:
  - `SESSION_ID` from `data.session_id`
  - `CURRENT_COST` from `data.current_cost` (JSON array)

✓ If status is "success" → Continue to section 2
⚠ If status is "confirm_session":
  - Extract `detected_filter` from response
  - Display to user: "Auto-detected session filter: '{detected_filter}'"
  - Use AskUserQuestion:
    - "Yes, use this session filter" (recommended)
    - "No, let me specify a different filter"
  - If "Yes": Save to `settings.plugins.write-git-commit.json`:
    ```bash
    echo '{"sessionFilter":"'$detected_filter'"}' | jq '.' > settings.plugins.write-git-commit.json
    ```
  - If "No": Ask user for session filter substring, save it, then re-run prepare step

✗ If status is "error" → Display error message and stop

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

→ Run commit-workflow.sh to build message:
```bash
RESPONSE=$(bash ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh build-message \
  "$COMMIT_SUBJECT" "$COMMIT_BODY" "$SESSION_ID" "$CURRENT_COST")
FULL_MESSAGE=$(echo "$RESPONSE" | jq -r '.data.full_message')
```

→ Display the full commit message to user in plain text (with blank lines before and after):

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

→ Run: `bash ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh create-commit "$FULL_MESSAGE"`
→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 5
✗ If status is "error" → Display error, return to section 2

## 5. Success

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: <COMMIT_SHA>

📊 Session metrics:
   ID: <SESSION_ID>
   <for each model in CURRENT_COST: "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}">
```

✓ Done - Return to user

---

🔧 Configuration: `settings.plugins.write-git-commit.json` (optional, created on first run)
  - `sessionFilter`: Filter sessions by substring (auto-detected from project directory on first run)
    - Example: `"claude-plugins"` to filter sessions containing "claude-plugins"

📁 Scripts used (all in `skills/write-git-commit/scripts/`):
  - `commit-workflow.sh` - Master orchestrator (handles all workflow logic)
  - `load-config.sh` - Config loading with auto-detection (sourced by workflow script)
  - `claude-session-cost.sh` - Fetch current session costs (called by workflow script)

📝 Cost metrics are stored in git commit footers using the `Claude-Cost-Metrics:` git trailer format
