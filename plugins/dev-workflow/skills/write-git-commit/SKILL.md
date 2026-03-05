---
name: write-git-commit
description: Create a git commit with trailers for session cost metrics and Claude attribution. Use when the user asks you to commit changes to git.
context: fork
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

Use this skill to create a git commit with a message summarizing changes and trailers for attribution and cost metrics.

**MANDATORY** only activate this skill when the user invokes it directly (`/write-git-commit`) OR prompts you to commit. Examples:
- "[git] commit"
- "commit [this | my changes | to git]"
- "save to git"

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

**Use this copyable checklist to ensure you follow ALL steps of this skill workflow:**

```
- [ ] 0. Prerequisites
- [ ] 1a. Check for existing configuration
- [ ] 1b. Create new configuration (if needed)
- [ ] 2. Stage and analyze changes
- [ ] 3. Generate commit message
- [ ] 4. Get user approval
- [ ] 5. Fetch session costs
- [ ] 6. Create commit
- [ ] 7. Display summary
```

---

# Skill Context 

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If the line above shows the literal text `${CLAUDE_SKILL_DIR}` instead of
an actual file path, halt immediately and tell the user:
"This skill requires Claude Code 2.1.69 or higher."

**Usage:** Replace `{{SKILL_BASE_DIR}}` with the path shown above when executing bash commands
in reference files.

**Node.js Check**: !`node -e "process.exit(parseInt(process.version.slice(1)) >= 22 ? 0 : 1)" 2>/dev/null && echo "✓ Node.js $(node -v)" || echo "ERROR: Node.js 22+ required (found: $(node -v 2>/dev/null || echo 'not installed')). Install: https://nodejs.org/"`

⛔ **HALT** if Node.js Check shows `ERROR`.

**Git Instructions Check**: !`( [ "$CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS" = "1" ] || node -e "const fs=require('fs');const f=[process.env.HOME+'/.claude/settings.json','.claude/settings.json'];process.exit(f.some(p=>{try{return JSON.parse(fs.readFileSync(p,'utf8')).includeGitInstructions===false}catch(e){return false}})?0:1)" 2>/dev/null ) && echo "OK" || echo "WARNING: includeGitInstructions is not disabled. Built-in git instructions may conflict with this skill. Set includeGitInstructions: false in .claude/settings.json — see skill README for details."`

→ If the above check shows WARNING, display it to the user before proceeding.

**Dependencies**: !`[ -d "${CLAUDE_SKILL_DIR}/../../node_modules" ] || (npm install --prefix "${CLAUDE_SKILL_DIR}/../.." --silent 2>&1 && echo "Plugin dependencies installed." || echo "WARNING: Failed to install plugin dependencies.")`

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Delegation Protocol

When you see `DELEGATE_TO: [file]`:  
⛔ **STOP** → Use Read tool on the reference file path  
→ Execute its instructions exactly (bash commands, parsing, etc.)  
→ Return to SKILL.md only after completing reference file instructions  

⚠️  **IMPORTANT:** Reference files contain Bash tool commands - use them exactly as written - never improvise commands.

### B. Template Substitution

**MANDATORY**: Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Path shown in "Skill Context > SKILL_BASE_DIR" above
- `{{SESSION_ID}}` → Session ID value, resolved from skill configuration (Step 1) 

### C. Narration Control

⚠️  **SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently - no explanatory text.

### D. JSON Response Protocol

All script outputs return JSON. Extract fields and store in variables:
- Syntax: `json.field.path` → VARIABLE_NAME
- Example: `data.session_id` → SESSION_ID

---

# Skill Workflow Instructions

## 0. Prerequisites

## 0a. Pre-Flight Check

⛔ **HALT if TRUE**: Already ran `git status/diff/log` in parallel OR drafted commit message OR executing system git workflow. STOP skill immediately.  
✅ **CONTINUE if TRUE**: No git commands executed yet. Continue.

## 0b. Check for Config

**SKILL_NAME**: write-git-commit

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.write-git-commit.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

**Configuration Routing:**
- If `SKILL_CONFIG` = `✓ Configuration found` → Proceed to Step 1a (Load Configuration)
- If `SKILL_CONFIG` = `NOT_CONFIGURED` → Skip Step 1a, proceed to Step 1b (Create Configuration)

## 1. Resolve SessionID

### 1a. Load existing configuration

→ Execute using Bash tool:
```bash
cat .claude/settings.plugins.write-git-commit.json
```

→ Parse JSON output and extract `sessionId` field value  
→ Store as SESSION_ID for use in subsequent steps  
→ Proceed to Step 2  

### 1b. Create new configuration

→ **MANDATORY:** Tell the user: "⚠️  Skill configuration not found! (./.claude/settings.plugins.write-git-commit.json). Let's create it:"  

→ Run Bash command to list available sessions:
```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" list-sessions
```

→ Parse JSON output: Extract sessions array from `data.sessions` field.  
→ Use AskUserQuestion to ask user "Select a Claude Code session:" with options from first 4 sessions (each option label = sessionId).  
→ Extract selected session ID from user response and store in `SELECTED_SESSION_ID` variable.  

→ Run Bash command to save selected session to config:
```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" save-config "$(pwd)" "{{SELECTED_SESSION_ID}}"
```

→ If save succeeds: Inform the user of the file location and continue to Step 2.  
→ If error occurs: Display error message to user and then **exit workflow immediately**.  

## 2. Stage and Analyze Changes

**IMPORTANT:** Only run the git commands below. Do **NOT** run other git command such as "git log --online" (previous commits are irrelevant).

### 2a. Stage changes

**STEP_DESCRIPTION**: "Staging changes"

→ Execute using Bash tool:
```bash
git add -A
```

### 2b. Analyze staged changes

**STEP_DESCRIPTION**: "Generating commit message"

**Generate commit message using ONE of these approaches:**

1. **IF you made source code edits in this conversation:** Use your existing knowledge of the changes to draft the commit message directly. Skip the git diff command.

2. **IF you have NOT made edits in this conversation:** Run `git diff --cached` to see what will be committed:
   ```bash
   git diff --cached
   ```
   Then use that output to generate the commit message.

Proceed to step 3 to draft the message according to the guidelines.

## 3. Generate Commit Message

DELEGATE_TO: `references/message_guidelines.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Extract COMMIT_SUBJECT and COMMIT_BODY per the reference file instructions.  
→ Proceed to Step 4.  

## 4. Display Message to User for Approval

**BLOCKING:** Requires user approval before Step 5.

DELEGATE_TO: `references/message_approval.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Extract APPROVAL_STATUS and updated COMMIT_SUBJECT, and COMMIT_BODY per reference file instructions.  

→ If APPROVAL_STATUS = "use_full" or "use_subject_only": Proceed to Step 5.  
→ If APPROVAL_STATUS = "request_revisions": Return to Step 3 to regenerate message.  

## 5. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Extract FETCH_STATUS per reference file instructions.

→ If FETCH_STATUS = "success":
  - → Extract `SESSION_ID` from reference file.
  - → Extract `CURRENT_COST` from reference file (validated JSON array).
  - → Proceed to Step 6 with SESSION_ID and CURRENT_COST values.

→ If FETCH_STATUS is not "success":
  - → Extract `ERROR_MESSAGE` from reference file.
  - → Display error message to user.
  - → Tell user "*** Session ID must be configured to accurately extract Claude Code cost metrics. Cannot create commit without valid cost metrics."
  - → HALT WORKFLOW - Do NOT proceed to Step 6 under any circumstances.

**IMPORTANT:** Cost must be present and accurate!
- ⛔ NEVER fabricate or estimate cost metrics. 
- ⛔ NEVER create a git commit with fake/estimated cost data.
- ⚠️  ONLY use results from a successful use of `ccusage` (FETCH_STATUS = "success")

## 6. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

**MANDATORY:** CHECK PREREQUISITES BEFORE PROCEEDING WITH COMMIT**
- **VERIFY** SESSION_ID and CURRENT_COST exist from Step 5 - if not, GO BACK TO STEP 5
- **VERIFY** APPROVAL_STATUS is "use_full" OR "use_subject_only" (from Step 4). If not: **Exit workflow immediately.**

DELEGATE_TO: `references/create_commit.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Extract STATUS per reference file instructions.

→ If STATUS = "success":
  - → Extract `COMMIT_SHA` from reference file.
  - → Proceed to Step 7 with COMMIT_SHA and SESSION_ID values.

→ If STATUS is not "success":
  - → Extract `ERROR_MESSAGE` from reference file.
  - → Display ERROR_MESSAGE to user.
  - → Exit workflow immediately.

## 7. Summary

→ Display success summary with the following format:
```
✅ Commit created with session cost metrics in footer
   SHA: {COMMIT_SHA}

📊 Session metrics:
   ID: {SESSION_ID}
   (for each model in CURRENT_COST array):
      - {model}: {inputTokens} in + {outputTokens} out = ${cost}
```

→ Return to user.
