---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

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

---

**⚠️ CRITICAL EXECUTION RULES**

These rules apply to all sections below. Violations break the workflow:

- **No improvisation**: The `commit-workflow.sh` script handles all commit creation logic (message assembly, metrics embedding, git execution). Do not duplicate or bypass this logic.
- **Metrics are automatic**: The `commit` action auto-fetches `SESSION_ID` and `CURRENT_COST` if not in env. You only need to provide the commit message (subject + body) via stdin.
- **User approval is mandatory**: Section 1e MUST execute AskUserQuestion before any commit is created. Never skip to section 2 without explicit user approval. This is a hard requirement.

---

## 1. Generate and Approve Commit Message

### 1a. Stage changes

→ Stage all uncommitted changes
  - Run `git add -A`

### 1b. Analyze staged changes

→ Examine staged changes
  - Run `git diff --cached`

### 1c. Generate a Commit Message

Generate a commit message based on diff changes and the current chat context.

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

→ Output the commit message as TEXT in your response (do NOT use tools):
  - Add a blank line
  - Output the complete commit message (subject + body if present)
  - Add a blank line after

**Example:**
```
<blank line>
Add user authentication feature

- Implement JWT-based auth flow
- Add login/logout endpoints
<blank line>
```

⚠️ IMPORTANT:
  - This MUST be plain text output, NOT a tool call
  - Do NOT batch this with step 1e - display first, THEN ask for approval
  - The message must be visible to the user before AskUserQuestion is called

---
⚠️ CHECKPOINT: Commit message must be displayed above before proceeding to step 1e
---

### 1e. Obtain User Approval or Revisions (REQUIRED - DO NOT SKIP)

⚠️ CRITICAL DECISION POINT: This step MUST be completed before any further action

→ MUST use AskUserQuestion with these exact options:
  - "Accept this message?" (Recommended)
  - "Make changes"
  - "Stop/Cancel commit"

→ Handle user response:

✓ If "Accept this message?"
  → Extract `COMMIT_SUBJECT` (first line)
  → Extract `COMMIT_BODY` (remaining lines, may be empty)
  → Proceed to section 2

✗ If "Make changes"
  → Return to step 1c
  → Regenerate message based on user feedback
  → Return to step 1e (loop until approved or cancelled)

✗ If "Stop/Cancel commit"
  → Exit workflow immediately
  → Do NOT proceed to section 2
  → Return control to user

---
⚠️ CHECKPOINT: Do not proceed past this line without user approval from AskUserQuestion above
---

## 2. Prepare Cost Data

⚠️ PREREQUISITE: Section 1e MUST be completed before entering this section
   - User MUST have been prompted via AskUserQuestion in step 1e
   - User MUST have selected "Accept this message?"
   - If not completed, STOP and return to section 1

→ Check if config exists: `bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh" check-config`
→ Parse JSON output based on status:

✓ If status is "found": Config exists and is valid, proceed to prepare step
✗ If status is "not_found" or "empty": Config missing, proceed with auto-detection in prepare step
✗ If status is "invalid": Config file is corrupted, display error and stop

→ Run prepare: `bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh" prepare`
→ Parse JSON output based on status:

✓ If status is "success":
  - Extract `SESSION_ID` from `data.session_id`
  - Extract `CURRENT_COST` from `data.current_cost` (JSON array)
  - Continue to section 3

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

## 3. Create Commit

⚠️ PREREQUISITE: Sections 1e and 2 MUST be completed
   - User approved commit message in 1e
   - Cost data prepared successfully in section 2
   - If not completed, STOP

→ Run commit action with commit message via stdin:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/commit-workflow.sh" commit <<'EOF'
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
  - `SESSION_ID` and `CURRENT_COST` are auto-fetched by the commit action
  - Optional: Override `SESSION_ID` with inline env var: `SESSION_ID="..." bash ...`

→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 4
✗ If status is "error" → Display error, return to section 2

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
