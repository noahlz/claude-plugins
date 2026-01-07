---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user mentions: "commit", "commit my changes", "commit this", "save to git", "check in".

---

This skill creates a git commit with a summary and optional body consisting for terse bullet points and git trailers for attribution and cost metrics.

Activate when the user explicitly requests a git commit using phrases like:
- "commit my changes"
- "commit this"
- "save to git"
- "git commit"

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

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Prerequisites Chain

Do NOT proceed to Section 2 until Section 1e completes with user approval.

Do NOT proceed to Section 3 until Section 2 completes successfully.

Do NOT skip any section.

### B. Core Execution Rules

Do NOT improvise logic - `commit-workflow.js` handles all commit creation logic. Do not duplicate or bypass this logic.

MUST obtain user approval via AskUserQuestion in Section 1e before proceeding to Section 2.

**Environment Variables Do NOT Persist Between Bash Calls:**
- Each Bash tool invocation runs in a separate shell process
- Variables set via `source` are lost when that shell exits
- MUST always capture values as literal strings using `echo` in the SAME bash call where they're sourced
- In subsequent bash commands, use captured literal values (not shell variables)
- Example: If Section 2a outputs `SESSION_ID=abc-123`, use the literal string `"abc-123"` in later commands, not `$SESSION_ID`

### C. Display Format Requirements

- MUST display commit message with ASCII box borders (━ characters) - this is mandatory.
- Output MUST be plain text (direct output, NOT a tool call).
- Do NOT batch display with approval request - display first, THEN ask for approval in a separate step.

**Template for displaying commit message:**
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Subject line]

[Body if present]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### D. Standard Result Handling Pattern

When executing bash commands that call commit-workflow.js scripts:

1. Execute the bash command and capture the output  
2. Look for the `RESULT_STATUS` value echoed in output  
3. Handle the result based on status:
   - **If status is "success"**: Capture the values (SESSION_ID, CURRENT_COST, etc) from echo output and proceed
   - **If status is "found"**: Capture SESSION_ID from echo output and proceed
   - **If status is "not_found"**: Capture CALCULATED_SESSION_ID from echo output and proceed to user choice (Section 2c)
   - **If status is "error"**: Display error message from RESULT_MESSAGE and stop or retry as instructed in the section

Use this pattern consistently in Sections 2a, 2b, and 2d instead of repeating full handling text.

---

## 0. Prerequisites

**SKILL_NAME**: write-git-commit

**CLAUDE_PLUGIN_ROOT**: !`if [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then $HOME/.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; elif [ -x "./.claude/resolve_plugin_root.sh" ]; then ./.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; else echo "⚠️ Run dev-workflow:setup to install resolver"; fi`

---

If you see "⚠️ Run dev-workflow:setup" above, the resolver script is missing. Stop and run the setup skill.

**⚠️ CRITICAL - Capture this value for substitution throughout the skill:**

The CLAUDE_PLUGIN_ROOT value shown above (after the ! command executes) is the literal plugin path.

**You MUST:**
1. Store this literal path value - you will use it to replace **__PLUGIN_ROOT__** in bash commands below
2. In ALL bash commands throughout this skill, replace **__PLUGIN_ROOT__** with the exact literal path shown above
3. Example: If you see /Users/username/.claude/plugins/cache/dev-workflow/0.1.0, then replace every **__PLUGIN_ROOT__** → /Users/username/.claude/plugins/cache/dev-workflow/0.1.0

See Workflow Rules section B for environment variable scoping requirements.

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
      - User explicitly requested, i.e. "commit with just a summary"
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

Display the commit message using the format specified in Workflow Rules section C. Follow those format requirements exactly.

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

## 2. Prepare Cost Data

See Workflow Rules section A for prerequisite requirements before entering this section.

### 2a. Check for Existing Config

→ Execute using Bash tool:
```bash
# ⚠️ CRITICAL: Replace __PLUGIN_ROOT__ with literal path from Section 0
# This is NOT a shell variable - it's a placeholder requiring substitution
# Example: /Users/username/.claude/plugins/cache/dev-workflow/0.1.0

# Set CLAUDE_PLUGIN_ROOT as environment variable for this command
# (Required: Node.js script checks process.env.CLAUDE_PLUGIN_ROOT)
TMP_CONFIG_CHECK="/tmp/write-git-commit-config-check-$$.sh"
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" check-config "$(pwd)" "$TMP_CONFIG_CHECK" --export-vars
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
# Replace __PLUGIN_ROOT__ with literal path from Section 0
TMP_RESOLVE="/tmp/write-git-commit-resolve-$$.sh"
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" resolve-session "$(pwd)" "$TMP_RESOLVE" --export-vars
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
    → Execute using Bash tool:
    ```bash
    # Replace __PLUGIN_ROOT__ and __SESSION_ID__ with literal values from echo output
    CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
    node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "__SESSION_ID__"
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
    → Execute using Bash tool:
    ```bash
    # Replace __PLUGIN_ROOT__ and __USER_SESSION_ID__ with literal values
    CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
    node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "__USER_SESSION_ID__"
    ```
  - Proceed to Section 2d (Fetch Costs)

**Case 2: "Show available sessions and pick one"**

→ Execute using Bash tool:
```bash
# Replace __PLUGIN_ROOT__ with literal path from Section 0
TMP_SESSIONS="/tmp/write-git-commit-sessions-$$.txt"
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" list-sessions "$TMP_SESSIONS"

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
        → Execute using Bash tool:
        ```bash
        # Replace __PLUGIN_ROOT__ and __SELECTED_SESSION_ID__ with literal values
        CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
        node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "__SELECTED_SESSION_ID__"
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

→ Execute using Bash tool:
```bash
# Replace __PLUGIN_ROOT__ and __SESSION_ID__ with literal values
TMP_PREPARE="/tmp/write-git-commit-prepare-$$.sh"
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" prepare "$(pwd)" "__SESSION_ID__" "$TMP_PREPARE" --export-vars
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

See Workflow Rules section A for prerequisite requirements before entering this section.

→ Execute using Bash tool:
```bash
# Replace __PLUGIN_ROOT__, __SESSION_ID__, __CURRENT_COST__, __COMMIT_SUBJECT__, and __COMMIT_BODY__
# with captured/approved literal values from previous sections
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
SESSION_ID="__SESSION_ID__" \
CURRENT_COST="__CURRENT_COST__" \
node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" commit <<'EOF'
__COMMIT_SUBJECT__

__COMMIT_BODY__
EOF
```

**Value replacements required:**
- `__SESSION_ID__`: Literal SESSION_ID captured from Section 2d echo output
- `__CURRENT_COST__`: Literal CURRENT_COST captured from Section 2d echo output (JSON array string, keep quotes)
- `__COMMIT_SUBJECT__`: Subject line approved by user in Section 1e
- `__COMMIT_BODY__`: Body lines approved by user in Section 1e (omit entire section if body is empty)

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

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: `COMMIT_SHA`

📊 Session metrics:
   ID: `SESSION_ID`
   (for each model in `CURRENT_COST`): "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}"
```

✓ Done - Return to user
