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
SKILL_NAME="write-git-commit"

# 1. Check Node.js version
if ! command -v node >/dev/null 2>&1; then
  echo "⚠️ Node.js 22+ required"
  echo "Install from https://nodejs.org/"
  exit 1
fi
NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "⚠️ Node.js $(node -v) found, but 22+ required"
  echo "Install from https://nodejs.org/"
  exit 1
fi

# 2. Check for resolver script (look in ./.claude first, then $HOME/.claude)
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  echo "⚠️ Missing plugin resolver script"
  echo ""
  echo "Run the setup skill to create it:"
  echo "  Use the dev-workflow:setup skill"
  echo ""
  exit 1
fi

# 3. Resolve plugin root
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || {
  echo "⚠️ Failed to resolve plugin root"
  echo "Try running the setup skill again:"
  echo "  Use the dev-workflow:setup skill"
  exit 1
}

# 4. Output for LLM to capture
echo "CLAUDE_PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT"
echo "✓ Ready (Node $(node -v))"
```

⚠️ CHECKPOINT: Verify you actually executed Bash tool above
- If you narrated without running Bash: STOP and run the commands now
- Check exit code to determine next step

**Result handling:**
✓ Exit 0 → Prerequisites met, **LLM captures CLAUDE_PLUGIN_ROOT from output**, proceed to section 1
✗ Exit 1 → Prerequisites missing, display error and **STOP** (no fallback)

**⚠️ CRITICAL**: After Section 0 succeeds, you MUST capture the `CLAUDE_PLUGIN_ROOT=<path>` value from the bash output above. Use this captured value in all subsequent bash commands that reference plugin scripts (don't use `${CLAUDE_PLUGIN_ROOT}` in bash, substitute the actual path directly). This is necessary because environment variables don't persist between separate Bash tool invocations.

---

**⚠️ CRITICAL EXECUTION RULES**

These rules apply to all sections below. Violations break the workflow:

- **No improvisation**: The `commit-workflow.js` script handles all commit creation logic (message assembly, metrics embedding, git execution). Do not duplicate or bypass this logic.
- **Environment variables required**: The script requires `SESSION_ID` and `CURRENT_COST` to be passed as environment variables (obtained from section 2). The script will load SESSION_ID from config if not in env, but CURRENT_COST must always be explicitly provided.
- **User approval is mandatory**: Section 1e MUST execute AskUserQuestion before any commit is created. Never skip to section 2 without explicit user approval. This is a hard requirement.

---

## 1. Generate and Approve Commit Message

### 1a. Stage changes

**Step description**: "Staging all uncommitted changes"

→ Stage all uncommitted changes using Bash tool:
```bash
git add -A
```

### 1b. Analyze staged changes

**Step description**: "Analyzing staged changes"

→ Examine staged changes using Bash tool:
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

→ Check if config exists:
```bash
TMP_CONFIG_CHECK="/tmp/write-git-commit-config-check-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" check-config "$TMP_CONFIG_CHECK" --export-vars
source "$TMP_CONFIG_CHECK"
```

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "found":**
  - Config exists with session ID
  - SESSION_ID variable is set
  - Skip to Section 2d (Fetch Costs)

**✗ If RESULT_STATUS is "not_found" or "empty":**
  - No config exists
  - Proceed to Section 2b (Resolve Session)

---

### 2b. Resolve Session ID

→ Attempt to resolve session ID from current directory:
```bash
TMP_RESOLVE="/tmp/write-git-commit-resolve-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" resolve-session "$TMP_RESOLVE" --export-vars
source "$TMP_RESOLVE"
```

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "found":**
  - Session ID resolved successfully
  - SESSION_ID variable is set
  - Save to config and proceed to Section 2d:
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" save-config "$SESSION_ID"
    ```
  - Skip to Section 2d (Fetch Costs)

**✗ If RESULT_STATUS is "not_found":**
  - Calculated session ID doesn't exist
  - CALCULATED_SESSION_ID variable is set (the ID that was tried)
  - Proceed to Section 2c (User Choice)

**✗ If RESULT_STATUS is "error":**
  - Display error message: $RESULT_MESSAGE
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
  - Save to config and proceed:
    ```bash
    SESSION_ID="$MANUAL_SESSION_ID"
    node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" save-config "$SESSION_ID"
    ```
  - Proceed to Section 2d (Fetch Costs)

**Case 2: "Show available sessions and pick one"**
  - Call list-sessions to get all sessions:
    ```bash
    TMP_SESSIONS="/tmp/write-git-commit-sessions-$$.sh"
    node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" list-sessions "$TMP_SESSIONS" --export-vars
    source "$TMP_SESSIONS"
    ```
  - Parse SESSIONS JSON array (should contain array of {sessionId, cost} objects)
  - Extract session IDs from SESSIONS
  - Build AskUserQuestion with dynamic options:
    - For each sessionId in first 4 sessions: Create option with label = sessionId
    - If CALCULATED_SESSION_ID is in the list: Mark it as "(Recommended)"
    - Add final option: "Other (enter manually)"
  - Handle user selection:
    - If user picks a session: Set SESSION_ID, save config, proceed to Section 2d
    - If user picks "Other": Return to Case 1 (manual entry)

**Case 3: "Cancel commit"**
  - Run `git reset HEAD` to unstage changes
  - Display: "Commit cancelled"
  - Exit workflow

---

### 2d. Fetch Costs

⚠️ PREREQUISITE: SESSION_ID must be set from Section 2a, 2b, or 2c

→ Call prepare with explicit session ID to fetch costs:
```bash
TMP_PREPARE="/tmp/write-git-commit-prepare-$$.sh"
node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" prepare "$SESSION_ID" "$TMP_PREPARE" --export-vars
source "$TMP_PREPARE"
```

→ Handle result based on RESULT_STATUS:

**✓ If RESULT_STATUS is "success":**
  - Variables are set: $SESSION_ID, $CURRENT_COST, $METHOD
  - Proceed to section 3 (Create Commit)

**✗ If RESULT_STATUS is "error":**
  - Display error message: $RESULT_MESSAGE
  - Use AskUserQuestion:
    - "Stop and investigate" (Recommended)
    - "Commit without metrics"
    - "Try different session"
  - Handle as per Section 2c (Return to Case 1 for manual entry or Case 2 for session list)

## 3. Create Commit

⚠️ PREREQUISITE: Sections 1e and 2 MUST be completed
   - User approved commit message in 1e
   - Cost data prepared successfully in section 2
   - If not completed, STOP

→ Run commit action with commit message via stdin:
```bash
SESSION_ID="$SESSION_ID" CURRENT_COST="$CURRENT_COST" node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" commit <<'EOF'
COMMIT_SUBJECT
[blank line]
COMMIT_BODY (if present)
EOF
```

**Format rules:**
  - If body is empty: Only subject (no blank line after)
  - If body exists: Subject, blank line, then body

⚠ IMPORTANT:
  - This bash command should NOT trigger permission prompts - user already approved message in section 1e and session in section 2
  - Commit message is passed via stdin (heredoc)
  - `SESSION_ID` and `CURRENT_COST` MUST be passed as environment variables (extracted from section 2)
  - Both variables must be set from the values resolved in section 2 before invoking this command

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

---

🔧 Configuration: `.claude/settings.plugins.write-git-commit.json` (created on first run)
  - `sessionId`: Exact session ID (e.g., "-Users-noahlz-projects-claude-plugins")
  - Auto-detected from project path on first run

📁 Use scripts under `$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/`

📝 Cost metrics are stored in git commit footers using the `Claude-Cost-Metrics:` git trailer format
