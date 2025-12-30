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

## 0. Resolve CLAUDE_PLUGIN_ROOT

→ Resolve plugin root environment (check local project first, then user home):
```bash
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  echo "Error: resolve_plugin_root.sh not found in ./.claude/ or $HOME/.claude/" >&2
  exit 1
fi
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || { echo "Error: Failed to resolve plugin root" >&2; exit 1; }
export CLAUDE_PLUGIN_ROOT
```

✓ Plugin root resolved → Proceed to step 0a (Check Node.js)

## 0a. Check Node.js Installation

Execute the steps in `${CLAUDE_PLUGIN_ROOT}/common/check-node.md` to determine if node 22+ is available.

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

→ Stage all uncommitted changes
  - Run `git add -A`

### 1b. Analyze staged changes

**Step description**: "Analyzing staged changes"

→ Examine staged changes
  - Run `git diff --cached`

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

→ Check if config exists:
```bash
CHECK_CONFIG_RESULT=$(node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" check-config)
CONFIG_STATUS=$(echo "$CHECK_CONFIG_RESULT" | jq -r '.status')
```

→ Parse result based on status:

- ✓ If `CONFIG_STATUS` is "found": Extract `SESSION_ID` from `CHECK_CONFIG_RESULT | jq -r '.data.config.sessionId'` → Jump to section 2b
- ✗ If `CONFIG_STATUS` is "not_found" or "empty": No config exists → Jump to section 2a-select
- ✗ If `CONFIG_STATUS` is "invalid": Config file is corrupted, display error: "Configuration file is corrupted. Please delete `.claude/settings.plugins.write-git-commit.json` and try again." → Stop workflow

---

### 2a. Session Resolution (No Config Case)

⚠️ NOTE: Only execute this section if config was NOT found in section 2 check

**2a-detect: Detect Recommended Session**

→ Compute recommended session ID from current working directory:
```bash
PWD_SESSION_ID=$(echo "$PWD" | sed 's/\//\-/g' | sed 's/^-//')
```

**2a-list: List Available Sessions**

→ List available sessions via library-first, CLI-fallback:
```bash
SESSIONS_RESULT=$(node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" list-sessions)
SESSIONS=$(echo "$SESSIONS_RESULT" | jq -r '.data // []')
```

→ Parse session list:
  - If no sessions available: Display "No sessions found in ccusage library or CLI. Install ccusage: npm install -g ccusage" → Stop workflow
  - If sessions available: Proceed to 2a-select

**2a-select: Select Session ID**

→ Build AskUserQuestion with dynamic options from available sessions:
  - For each session in SESSIONS (limit to first 4-5 options):
    - Extract `sessionId` from session object
    - Create option with sessionId as label
    - If sessionId matches `PWD_SESSION_ID`: Append " (Recommended)" to label
  - Add final option: "Other (enter manually)" for manual session ID entry

→ Handle user selection:

**Case 1: User selects a session option (not "Other")**
  - Extract `SESSION_ID` from the selected option
  - Save to config:
    ```bash
    mkdir -p .claude
    echo '{"sessionId":"'$SESSION_ID'"}' > .claude/settings.plugins.write-git-commit.json
    ```
  - Proceed to section 2b

**Case 2: User selects "Other (enter manually)"**
  - Ask user: "Enter your session ID (format: -path-to-project)"
  - Validate format: Must start with `-` and contain hyphens
  - If invalid format: Re-prompt user to enter valid format
  - Save to config with the manually entered SESSION_ID:
    ```bash
    mkdir -p .claude
    echo '{"sessionId":"'$SESSION_ID'"}' > .claude/settings.plugins.write-git-commit.json
    ```
  - Proceed to section 2b

---

### 2b. Fetch Costs with prepare() Action

→ Call prepare() with resolved SESSION_ID to fetch costs via library-first, CLI-fallback:
```bash
PREPARE_RESULT=$(node "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.js" prepare "$SESSION_ID")
PREPARE_STATUS=$(echo "$PREPARE_RESULT" | jq -r '.status')
```

→ Parse result based on status:

**✓ If `PREPARE_STATUS` is "success":**
  - Extract `CURRENT_COST` from `PREPARE_RESULT | jq -r '.data.current_cost'`
  - Extract `METHOD` from `PREPARE_RESULT | jq -r '.data.method'` (library or cli)
  - Proceed to section 3 (Create Commit)

**✗ If `PREPARE_STATUS` is "error":**
  - Extract error message from `PREPARE_RESULT | jq -r '.message'`
  - Proceed to section 2d (Handle Error)

---

### 2d. Handle Cost Resolution Failure

⚠️ CRITICAL: Cost resolution failed. AskUserQuestion with options:
  - "Stop and investigate" (Recommended)
  - "Commit without metrics"
  - "Retry with different session"

→ **If "Stop and investigate":**
  - Run `git reset HEAD` to unstage changes
  - Display: "Changes unstaged. Please check ccusage installation and session data."
  - Run and display: `ccusage session --json` to show available sessions
  - Exit workflow

→ **If "Commit without metrics":**
  - Warn: "⚠️  Proceeding WITHOUT cost metrics in commit footer"
  - Set `CURRENT_COST='[]'` (empty array as placeholder)
  - Proceed to section 3 (Create Commit)

→ **If "Retry with different session":**
  - Jump back to section 2a-select to allow session re-selection

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
