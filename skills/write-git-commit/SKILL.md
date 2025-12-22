---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

## 1. Prepare Cost Data

→ First, check if config exists: `bash skills/write-git-commit/scripts/commit-workflow.sh check-config`
→ Parse JSON output based on status:

✓ If status is "found": Config exists and is valid, proceed to prepare step
✗ If status is "not_found" or "empty": Config missing, proceed with auto-detection in prepare step
✗ If status is "invalid": Config file is corrupted, display error and stop

→ Run prepare: `bash skills/write-git-commit/scripts/commit-workflow.sh prepare`
→ Parse JSON output based on status:

✓ If status is "success":
  - Extract `SESSION_ID` from `data.session_id`
  - Extract `CURRENT_COST` from `data.current_cost` (JSON array)
  - Continue to section 2

⚠ If status is "confirm_session":
  - Extract `detected_id` from `data.detected_id`
  - Display: "Auto-detected session ID: '{detected_id}'"
  - Use AskUserQuestion:
    - "Yes, use this session ID"
    - "No, let me specify a different ID"
  - If "Yes": Save to config:
    ```bash
    mkdir -p .claude
    echo '{"sessionId":"'$detected_id'"}' | jq '.' > .claude/settings.plugins.write-git-commit.json
    ```
    Then re-run prepare step
  - If "No": Ask user for exact session ID, save to config, re-run prepare

✗ If status is "error":
  - Display error message and stop
  - Suggest: Run `ccusage session --json` to see available sessions

## 2. Generate and Approve Commit Message

→ Analyze staged changes with `git diff --cached` and generate commit message:
  - **Subject line**: Action verb + brief description (imperative mood, max 72 chars)
    - Examples: "Add dark mode toggle", "Fix authentication bug", "Refactor user service"
  - **Body**:
    - Prefer concise, minimal bullets on first attempt. Target 1-2 bullets max, only up to 3 if there are distinct, separate concerns
    - Focus on the most significant changes. Avoid trying to capture every detail
    - Each bullet: focus on "what changed" and "why changed" - not "how changed"
    - *DO NOT* Include metrics obtainable from a git diff or CI/CD logs, such as files edited or number of passing tests

→ Display suggested message to user:

```
[blank line]
[suggested message here]
[blank line]
```

→ Ask user with AskUserQuestion:
  - "Accept this message?"
  - "Make changes"
  - "Stop/Cancel commit"

✓ If "Accept" → Extract `COMMIT_SUBJECT` (first line) and `COMMIT_BODY` (remaining) → Set internal flag `REVISION_REQUESTED=false` → Continue to section 3
✗ If "Make changes" → Go to section 2a
✗ If "Stop" → Exit workflow

## 2a. Get Feedback and Regenerate Message

→ Ask user what changes they'd like to make:
  - Question: "What would you like to change about this commit message?"
  - They should describe the issue (e.g., "add more detail about X", "remove Y", "focus on Z")

→ Analyze feedback and regenerate commit message with adjustments:
  - Apply user's requested changes
  - Maintain same guidelines: max 3 bullets, highlight new files, imperative mood
  - Generate new version of the message

→ Display the revised message

→ Ask user with AskUserQuestion:
  - "Accept this revised message?"
  - "Provide more feedback"
  - "Stop/Cancel commit"

✓ If "Accept" → Extract `COMMIT_SUBJECT` (first line) and `COMMIT_BODY` (remaining) → Set internal flag `REVISION_REQUESTED=true` → Continue to section 3
✗ If "More feedback" → Stay in section 2a and loop
✗ If "Stop" → Exit workflow

## 3. Preview Commit Message

→ Build the full commit message preview showing exactly what will be committed:

```
[COMMIT_SUBJECT]

[COMMIT_BODY if not empty]

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: {"sessionId":"[SESSION_ID]","cost":[CURRENT_COST as compact JSON]}
```

→ Display to user clearly with markdown formatting:

```markdown

Here's the commit message that will be created:

---
[paste the full message above with proper line breaks]
---

```

⚠ IMPORTANT: Always display the preview above BEFORE any confirmation logic

→ Fast-track path (if `REVISION_REQUESTED=false`):
  - User already approved the message in section 2 without requesting changes
  - Show the preview for final verification only
  - Proceed directly to section 4 (no additional approval needed)

→ Revision review path (if `REVISION_REQUESTED=true`):
  - User approved a revised message in section 2a
  - Use AskUserQuestion to get final confirmation:
    - "Proceed with this commit?"
    - "No, let me revise the message"
    - "Stop/Cancel commit"
  - ✓ If "Proceed" → Continue to section 4
  - ✗ If "No, revise" → Return to section 2a
  - ✗ If "Stop" → Exit workflow

## 4. Create Commit

→ Run commit action with commit message via stdin:
```bash
bash skills/write-git-commit/scripts/commit-workflow.sh commit <<'EOF'
[COMMIT_SUBJECT]

[COMMIT_BODY if not empty]
EOF
```

⚠ IMPORTANT:
  - This bash command should NOT trigger permission prompts - user already approved in section 2 or 3
  - Commit message is passed via stdin (heredoc)
  - SESSION_ID and CURRENT_COST are auto-fetched by the commit action
  - Optional: Override SESSION_ID with inline env var: `SESSION_ID="..." bash ...`

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

🔧 Configuration: `.claude/settings.plugins.write-git-commit.json` (created on first run)
  - `sessionId`: Exact session ID (e.g., "-Users-noahlz-projects-claude-plugins")
  - Auto-detected from project path on first run

📁 Scripts used (all in `skills/write-git-commit/scripts/`):
  - `claude-session-cost.sh` - Fetch current session costs (called by workflow script)
  - `commit-workflow.sh` - Master orchestrator (handles all workflow logic)
  - `load-config.sh` - Config loading with auto-detection (sourced by workflow script)
  - `verify-session.sh` - Session ID verification (called by workflow script)

📝 Cost metrics are stored in git commit footers using the `Claude-Cost-Metrics:` git trailer format
