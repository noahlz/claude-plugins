---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user mentions: "commit", "create a commit", "make a commit", "commit these/my/the changes", "commit this/it", "save to git", "check in", or when your next task is to commit completed work.
---

This skill creates a git commit with a summary and optional body consisting for terse bullet points and git trailers for attribution and cost metrics.

Activate when the user explicitly requests a git commit using phrases like:
- "commit these/my/the changes"
- "create/make a commit"
- "commit this/it"
- "save to git" / "check this in"
- "git commit"

Also activate proactively when you've completed a significant task and recognize committing would be the natural next step (but ASK first via the skill's approval workflow).

---

**⚠️ CRITICAL: HOW TO EXECUTE BASH CODE IN THIS SKILL**

When you see inline bash code blocks (```bash), you MUST:
- Execute them using the Bash tool
- NEVER narrate execution without actually running the command
- NEVER fabricate outputs

When instructed to "Execute from [file.md]" or "Execute instructions from [file.md]":
1. Read the markdown file using Read tool
2. Find the relevant bash code blocks
3. Execute those code blocks using Bash tool
4. Handle results as described in the file

**Failure to execute commands results in workflow corruption and invalid commits.**

---

## 0. Prerequisites

**Step description**: "Checking prerequisites"

→ Execute prerequisite check using Bash tool:
```bash
# 1. Check for resolver script (look in ./.claude first, then $HOME/.claude)
RESOLVER=""
if [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
elif [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
else
  echo "⚠️ Missing plugin resolver script"
  echo ""
  echo "Run the setup skill to create it:"
  echo ""
  echo "  dev-workflow:setup"
  echo ""
  exit 1
fi

# 2. Resolve plugin root
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || {
  echo "⚠️ Failed to resolve plugin root?!?"
  exit 1
}

# 3. Output for LLM to capture
echo "CLAUDE_PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT"
echo "SKILL_NAME=write-git-commit"
```

⚠️ CHECKPOINT: Verify you actually executed Bash tool above
- If you narrated without running Bash: STOP and run the commands now
- Check exit code to determine next step

**Result handling:**  
✓ Exit 0 → Prerequisites met, **LLM captures CLAUDE_PLUGIN_ROOT from output**, proceed to section 1  
✗ Exit 1 → Prerequisites missing, display error and **STOP** (no fallback)  


**⚠️ CRITICAL**: Use the `CLAUDE_PLUGIN_ROOT` value output in subsequent commands in this skill. Either interpolate the literal value or prefix each bash command with the value i.e. `CLAUDE_PLUGIN_ROOT=(literal value) (bash command)`

---

**⚠️ CRITICAL EXECUTION RULES**

These rules apply to all sections below. Violations break the workflow:

- **No improvisation**: The `commit-workflow.js` script handles all commit creation logic (message assembly, metrics embedding, git execution). Do not duplicate or bypass this logic.
- **Execute all bash blocks**: When you see a bash code block, you MUST execute it using the Bash tool. NEVER narrate or skip execution. Bash blocks are preceded by `→ Execute using Bash tool:`.
- **Environment variables don't persist**: Each Bash tool call runs in a separate shell process. Variables set via `source` are lost when that shell exits. Therefore:
  - Always capture variables as literal values using echo in the SAME bash call where they're sourced
  - Use captured literal values (not shell variables) in subsequent bash commands
  - Example: If Section 2a outputs `SESSION_ID=abc-123`, use the literal string `"abc-123"` in later commands
- **User approval is mandatory**: Section 1e MUST execute AskUserQuestion before any commit is created. Never skip to section 2 without explicit user approval. This is a hard requirement.

---

## 1. Generate and Approve Commit Message

### 1a. Stage changes

**Step description**: "Staging all uncommitted changes"

→ Execute using Bash tool:
```bash
git add -A
```

### 1b. Analyze staged changes

**Step description**: "Analyzing staged changes"

→ Execute using Bash tool:
```bash
git diff --cached
```

⚠️ CHECKPOINT: Verify git commands actually executed
- If you narrated without running Bash tool: STOP and run the commands now
- Review the actual diff output to understand what's being committed

### 1c. Generate a Commit Message

**Step description**: "Generating commit message"

Generate a commit message based on diff changes and the current chat context, but do not display it to the user yet.

→ General Guidelines:
  - Follow any user direction / customizations from their prompt i.e. "write a git commit summarizing this refactoring."
  - *DO NOT* Include metrics obtainable from a git diff or CI/CD logs, such as files edited, count or % of lines of code added/removed, or count of passing tests
  - **Important: Incorporate user feedback** If this is revision of a previously-generated commit body, take into account any user feedback on the previous iteration.

→ Subject and Body Guidelines:
  - **Subject line**: Action verb + brief description (imperative mood, max 72 chars)
    - Examples: "Add dark mode toggle", "Fix authentication bug", "Refactor user service"
  - **Body** (if needed):
    - **Default: No body** - Prefer summary-only commits when possible
    - **When to omit body (summary-only):**
      - Single file edited with cohesive changes
      - Change is straightforward and well-described by subject line
      - User explicitly requested "commit with just a summary"
    - **When to add body (bullets):**
      - Multiple files with different types of changes
      - Single file but changes span multiple unrelated areas
      - Complex change requiring context beyond subject
    - **Bullet guidelines (when used):**
      - Minimum: 2 bullets (if fewer, use summary-only instead)
      - Maximum: 4 bullets
      - Each bullet: focus on "what changed" and "why" - not "how"
      - Each bullet should add meaningful context not obvious from subject

### 1d. Display the Proposed Message (REQUIRED - DO NOT SKIP)

⚠️ CRITICAL: The user MUST see the commit message before being asked to approve it

⚠️ MANDATORY FORMAT REQUIREMENT: You MUST display the commit message with ASCII box borders (━ characters). This is NOT optional.

→ Display the commit message with visual formatting (plain text output, NOT a tool call):

**REQUIRED Format - Use this exact template:**
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Subject line]

[Body if present]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Example (with actual content):**
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add user authentication feature

- Implement JWT-based auth flow
- Add login/logout endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

⚠️ CRITICAL REQUIREMENTS:
  - Output MUST be plain text (direct output, NOT a tool call)
  - Box borders (━ lines) are MANDATORY - do not skip them
  - Do NOT batch this with step 1e - display first, THEN ask for approval
  - Do NOT output internal checkpoint text to the user

---
⚠️ CHECKPOINT: Verify message displayed above (this checkpoint text itself should NOT be shown to user)
---

### 1e. Obtain User Approval or Revisions (REQUIRED - DO NOT SKIP)

⚠️ CRITICAL DECISION POINT: This step MUST be completed before any further action

→ MUST use AskUserQuestion with these exact options:
  - "Accept this message?" (Recommended)
  - "Make changes"
  - "Stop/Cancel commit"

→ Handle user response:

✓ If "Accept this message?"
  - → Extract `COMMIT_SUBJECT` (first line)
  - → Extract `COMMIT_BODY` (remaining lines, may be empty)
  - → Proceed to section 2

✗ If "Make changes"
  - → Return to step 1c
  - → Regenerate message based on user feedback
  - → Return to step 1e (loop until approved or cancelled)

✗ If "Stop/Cancel commit"
  - → Exit workflow immediately
  - → Do NOT proceed to section 2
  - → Return control to user

---
⚠️ CHECKPOINT: Do not proceed past this line without user approval from AskUserQuestion above
---

## 2. Prepare Cost Data

⚠️ PREREQUISITE: Section 1e MUST be completed before entering this section
   - User MUST have been prompted via AskUserQuestion in step 1e
   - User MUST have selected "Accept this message?"
   - If not completed, STOP and return to section 1

### 2a. Check for Existing Config

→ Execute using Bash tool:
```bash
TMP_CONFIG_CHECK="/tmp/write-git-commit-config-check-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" check-config "$(pwd)" "$TMP_CONFIG_CHECK" --export-vars
source "$TMP_CONFIG_CHECK"
echo "RESULT_STATUS=$RESULT_STATUS"
if [ "$RESULT_STATUS" = "found" ]; then
  echo "SESSION_ID=$SESSION_ID"
fi
```

→ Capture from output:
- **RESULT_STATUS**: Echoed status value

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "found":**
  - Config exists with session ID
  - SESSION_ID is captured from echo output
  - Skip to Section 2d (Fetch Costs) with captured SESSION_ID literal value

**✗ If RESULT_STATUS is "not_found" or "empty":**
  - No config exists
  - Proceed to Section 2b (Resolve Session)

---

### 2b. Resolve Session ID

→ Execute using Bash tool:
```bash
TMP_RESOLVE="/tmp/write-git-commit-resolve-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" resolve-session "$(pwd)" "$TMP_RESOLVE" --export-vars
source "$TMP_RESOLVE"
echo "RESULT_STATUS=$RESULT_STATUS"
if [ "$RESULT_STATUS" = "found" ]; then
  echo "SESSION_ID=$SESSION_ID"
elif [ "$RESULT_STATUS" = "not_found" ]; then
  echo "CALCULATED_SESSION_ID=$CALCULATED_SESSION_ID"
elif [ "$RESULT_STATUS" = "error" ]; then
  echo "RESULT_MESSAGE=$RESULT_MESSAGE"
fi
```

→ Capture from output:
- **RESULT_STATUS**: Echoed status value
- **SESSION_ID** (if found): Echoed session ID
- **CALCULATED_SESSION_ID** (if not_found): Echoed calculated session ID
- **RESULT_MESSAGE** (if error): Echoed error message

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "found":**
  - Session ID resolved successfully
  - SESSION_ID captured from echo output
  - Save to config and proceed to Section 2d using captured SESSION_ID literal value:
    ```
    → Execute using Bash tool (replace <SESSION_ID> with captured value):
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "<SESSION_ID>"
    ```
    ```
  - Skip to Section 2d (Fetch Costs)

**✗ If RESULT_STATUS is "not_found":**
  - Calculated session ID doesn't exist
  - CALCULATED_SESSION_ID captured from echo output (the ID that was tried)
  - Proceed to Section 2c (User Choice), use captured CALCULATED_SESSION_ID for recommendations

**✗ If RESULT_STATUS is "error":**
  - Display error message from captured RESULT_MESSAGE
  - Exit workflow

---

### 2c. Handle Session Not Found

⚠️ NOTE: Only execute this section if RESULT_STATUS from Section 2b is "not_found"

→ Use AskUserQuestion to ask user what to do:
  - Option 1: "Enter session ID manually"
  - Option 2: "Show available sessions and pick one" (Recommended)
  - Option 3: "Cancel commit"

→ Handle user response:

**Case 1: "Enter session ID manually"**
  - Ask user: "Enter your session ID (format: -path-to-project)"
  - Example: `-Users-username-projects-myproject`
  - Validate format: Must start with `-` and contain hyphens
  - If invalid: Re-prompt for valid format
  - Save to config using captured session ID literal value and proceed:
    ```
    → Execute using Bash tool (replace <USER_SESSION_ID> with the session ID provided by user):
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "<USER_SESSION_ID>"
    ```
    ```
  - Proceed to Section 2d (Fetch Costs)

**Case 2: "Show available sessions and pick one"**

→ Execute using Bash tool:
```bash
TMP_SESSIONS="/tmp/write-git-commit-sessions-$$.txt"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" list-sessions "$TMP_SESSIONS"

# Read session IDs into array
SESSION_IDS=()
while IFS= read -r line; do
  SESSION_IDS+=("$line")
done < "$TMP_SESSIONS"

# Check if we got any sessions
if [ ${#SESSION_IDS[@]} -eq 0 ]; then
  echo "No sessions found."
  exit 1
fi

# Display for LLM to capture
echo "Available sessions (most recent activity first):"
for session_id in "${SESSION_IDS[@]}"; do
  echo "  $session_id"
done
```

→ Handle result based on exit code:

**✓ Exit 0 - Sessions found:**
  - Build AskUserQuestion with dynamic options:
    - For each sessionId in first 4 sessions from SESSION_IDS array: Create option with label = sessionId
    - If CALCULATED_SESSION_ID (from Section 2b) is in the list: Mark it as "(Recommended)"
    - Add final option: "Other (enter manually)"
  - Handle user selection:
    - If user picks a session:
      - Capture the selected session ID literal value from the user's selection
      - Save config using the captured literal:
        ```
        → Execute using Bash tool (replace <SELECTED_SESSION_ID> with the session ID selected by user):
        ```bash
        node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "<SELECTED_SESSION_ID>"
        ```
        ```
      - Proceed to Section 2d using captured literal value
    - If user picks "Other": Return to Case 1 (manual entry)

**✗ Exit 1 - No sessions:**
  - Display error message from bash output
  - Fall back to Case 1 (manual entry)

**Case 3: "Cancel commit"**
  - Run `git reset HEAD` to unstage changes
  - Display: "Commit cancelled"
  - Exit workflow

---

### 2d. Fetch Costs

⚠️ PREREQUISITE: SESSION_ID must be captured from Section 2a, 2b, or 2c

→ Execute using Bash tool (replace <SESSION_ID> with the literal SESSION_ID value captured from Section 2a, 2b, or 2c):
```bash
TMP_PREPARE="/tmp/write-git-commit-prepare-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" prepare "$(pwd)" "<SESSION_ID>" "$TMP_PREPARE" --export-vars
source "$TMP_PREPARE"
echo "RESULT_STATUS=$RESULT_STATUS"
if [ "$RESULT_STATUS" = "success" ]; then
  echo "SESSION_ID=$SESSION_ID"
  echo "CURRENT_COST=$CURRENT_COST"
  echo "METHOD=$METHOD"
elif [ "$RESULT_STATUS" = "error" ]; then
  echo "RESULT_MESSAGE=$RESULT_MESSAGE"
fi
```

→ Capture from output:
- **RESULT_STATUS**: Echoed status value
- **SESSION_ID**, **CURRENT_COST**, **METHOD** (if success): Echoed cost data
- **RESULT_MESSAGE** (if error): Echoed error message

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "success":**
  - SESSION_ID, CURRENT_COST, and METHOD are captured from echo output
  - Store these as literal values for use in Section 3
  - Proceed to section 3 (Create Commit) with captured literals

**✗ If RESULT_STATUS is "error":**
  - Display error message from captured RESULT_MESSAGE
  - Use AskUserQuestion:
    - "Stop and investigate" (Recommended)
    - "Commit without metrics"
    - "Try different session"
  - Handle as per Section 2c (Return to Case 1 for manual entry or Case 2 for session list)

## 3. Create Commit

⚠️ PREREQUISITE: Sections 1e and 2 MUST be completed
   - User approved commit message in 1e
   - Cost data prepared successfully in section 2
   - SESSION_ID and CURRENT_COST literals captured from section 2d
   - If not completed, STOP

→ Execute using Bash tool (replace <SESSION_ID>, <CURRENT_COST>, <COMMIT_SUBJECT>, and <COMMIT_BODY> with captured/approved values):
```bash
SESSION_ID="<SESSION_ID>" CURRENT_COST="<CURRENT_COST>" node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" commit <<'EOF'
<COMMIT_SUBJECT>

<COMMIT_BODY if present>
EOF
```

**Value replacements required:**
- `<SESSION_ID>`: Literal SESSION_ID captured from Section 2d echo output
- `<CURRENT_COST>`: Literal CURRENT_COST captured from Section 2d echo output (JSON array string, keep quotes)
- `<COMMIT_SUBJECT>`: Subject line approved by user in Section 1e
- `<COMMIT_BODY>`: Body lines approved by user in Section 1e (omit entire section if body is empty)

**Format rules:**
  - If body is empty: Only subject (no blank line)
  - If body exists: Subject, blank line, then body

⚠ IMPORTANT:
  - This bash command should NOT trigger permission prompts - user already approved message in section 1e and session in section 2
  - Commit message is passed via stdin (heredoc)
  - `SESSION_ID` and `CURRENT_COST` MUST be literal values captured from section 2d (not shell variables)

→ Validate cost metrics before sending commit:
  - Check COMMIT_COST is array with at least one entry
  - Check at least one model has cost > 0
  - If invalid: Return to section 2 to re-fetch metrics

→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 4  
✗ If status is "error" → Display error, return to section 2  

⚠ If status is "metrics_invalid":
  - Display error: "Cost metrics validation failed"
  - Show attempted_costs from data
  - Use AskUserQuestion:
    - "Stop and investigate" (Recommended)
    - "Commit without metrics"
    - "Retry fetching metrics"
  - If "Stop and investigate":
    - Run `git reset HEAD` to unstage changes
    - Display: "Changes unstaged. Please investigate ccusage data."
    - Stop workflow
  - If "Commit without metrics":
    - Warn: "Commit will proceed WITHOUT cost metrics"
    - Return to section 3 and re-run commit without validating metrics
  - If "Retry fetching metrics":
    - Return to section 2

⚠ If status is "git_error":
  - Display error: "Failed to create git commit"
  - Show error_message and/or staged_changes from data
  - Use AskUserQuestion:
    - "View git status"
    - "Unstage and stop"
  - If "View git status":
    - Run `git status` and display output
    - Ask user to resolve manually
  - If "Unstage and stop":
    - Run `git reset HEAD` to unstage changes
    - Stop workflow

## 4. Success

⚠️ PREREQUISITE: Section 3 completed successfully (commit created)

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: `COMMIT_SHA`

📊 Session metrics:
   ID: `SESSION_ID`
   (for each model in `CURRENT_COST`): "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}"
```

✓ Done - Return to user
