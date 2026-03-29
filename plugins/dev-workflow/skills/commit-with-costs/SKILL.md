---
name: commit-with-costs
description: Create a git commit with trailers for session cost metrics and Claude attribution. Use when the user asks you to commit changes to git.
model: sonnet
context: fork
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

Use this skill to create a git commit with a message summarizing changes and trailers for attribution and cost metrics.

**MANDATORY** only activate this skill when the user invokes it directly (`/commit-with-costs`) OR prompts you to commit. Examples:
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
- [ ] 2. Detect or generate commit message
- [ ] 3. Get user approval
- [ ] 4. Fetch session costs
- [ ] 5. Create commit
- [ ] 6. Display summary
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

**Node.js Check**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-node-version.js"`

⛔ **HALT** if Node.js Check shows `ERROR`.

**Git Instructions Check**: !`node "${CLAUDE_SKILL_DIR}/scripts/check-git-instructions.js"`

→ If the above check shows WARNING, display it to the user before proceeding.

**Dependencies**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-dependencies.js" "${CLAUDE_SKILL_DIR}/../.."`

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Delegation Protocol

When you see `DELEGATE_TO: [file]`:
⛔ **STOP** → Use Read tool on the reference file path
→ Execute its instructions exactly (bash commands, parsing, etc.)
→ Return to SKILL.md only after completing reference file instructions

⚠️  **IMPORTANT:** Reference files contain Bash tool commands - use them exactly as written - never improvise commands.

### B. Narration Control

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

⛔ **HALT if TRUE**: Already ran `git status/diff/log` in parallel OR executing system git workflow. STOP skill immediately.
✅ **CONTINUE if TRUE**: No git commands executed yet. Continue.

## 0b. Check for Config

**SKILL_NAME**: commit-with-costs

**SKILL_CONFIG**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.commit-with-costs.json"`

**Configuration Routing:**
- If `SKILL_CONFIG` = `✓ Configuration found` → Proceed to Step 1a (Load Configuration)
- If `SKILL_CONFIG` = `NOT_CONFIGURED` → Skip Step 1a, proceed to Step 1b (Create Configuration)

## 1. Resolve SessionID

### 1a. Load existing configuration

→ Execute using Bash tool:
```bash
cat .claude/settings.plugins.commit-with-costs.json
```

→ Parse JSON output and extract `sessionId` field value
→ Store as SESSION_ID for use in subsequent steps
→ Proceed to Step 2

### 1b. Create new configuration

→ **MANDATORY:** Tell the user: "⚠️  Skill configuration not found! (./.claude/settings.plugins.commit-with-costs.json). Let's create it:"

→ Run Bash command to list available sessions:
```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" list-sessions
```

→ Parse JSON output: Extract sessions array from `data.sessions` field.
→ Use AskUserQuestion to ask user "Select a Claude Code session:" with options from first 4 sessions (each option label = sessionId).
→ Extract selected session ID from user response and store in `SELECTED_SESSION_ID` variable.

→ Write config file:
```bash
echo '{"sessionId":"{{SELECTED_SESSION_ID}}"}' > .claude/settings.plugins.commit-with-costs.json
```

→ Inform the user of the file location and continue to Step 2.

## 2. Detect or Generate Commit Message

**Check conversation context:** Look for a `Proposed commit message:` block already present in this conversation (e.g., output from `/draft-commit-message`).

**If a proposed message IS found in the conversation:**
→ Extract COMMIT_SUBJECT (the line immediately after the ━━━ separator)
→ Extract COMMIT_BODY (any remaining lines before the closing ━━━ separator, or empty string if none)
→ Skip directly to Step 3 (approval).

**If NO proposed message is found:**
→ Stage and analyze:

DELEGATE_TO: `../../references/stage_and_analyze.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Generate commit message:

DELEGATE_TO: `../../references/message_guidelines.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract COMMIT_SUBJECT and COMMIT_BODY per the reference file instructions.
→ Proceed to Step 3.

## 3. Display Message to User for Approval

**BLOCKING:** Requires user approval before Step 4.

DELEGATE_TO: `../../references/message_approval.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract APPROVAL_STATUS and updated COMMIT_SUBJECT, and COMMIT_BODY per reference file instructions.

→ If APPROVAL_STATUS = "use_full" or "use_subject_only": Proceed to Step 4.
→ If APPROVAL_STATUS = "request_revisions": Return to Step 2 to regenerate message.

## 4. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract FETCH_STATUS per reference file instructions.

→ If FETCH_STATUS = "success":
  - → Extract `SESSION_ID` from reference file.
  - → Extract `CURRENT_COST` from reference file (validated JSON array).
  - → Extract `COST_METHOD` from reference file.
  - → Extract `COST_SINCE` from reference file.
  - → Extract `CLEANUP_PERIOD_DAYS` from reference file.
  - → Proceed to Step 5 with SESSION_ID, CURRENT_COST, COST_METHOD, COST_SINCE, and CLEANUP_PERIOD_DAYS values.

→ If FETCH_STATUS is not "success":
  - → Extract `ERROR_MESSAGE` from reference file.
  - → Display error message to user.
  - → Tell user "*** Session ID must be configured to accurately extract Claude Code cost metrics. Cannot create commit without valid cost metrics."
  - → HALT WORKFLOW - Do NOT proceed to Step 5 under any circumstances.

**IMPORTANT:** Cost must be present and accurate!
- ⛔ NEVER fabricate or estimate cost metrics.
- ⛔ NEVER create a git commit with fake/estimated cost data.
- ⚠️  ONLY use results from a successful use of `ccusage` (FETCH_STATUS = "success")

## 5. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

**MANDATORY:** CHECK PREREQUISITES BEFORE PROCEEDING WITH COMMIT**
- **VERIFY** SESSION_ID and CURRENT_COST exist from Step 4 - if not, GO BACK TO STEP 4
- **VERIFY** APPROVAL_STATUS is "use_full" OR "use_subject_only" (from Step 3). If not: **Exit workflow immediately.**

DELEGATE_TO: `references/create_commit.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract STATUS per reference file instructions.

→ If STATUS = "success":
  - → Extract `COMMIT_SHA` from reference file.
  - → Proceed to Step 6 with COMMIT_SHA and SESSION_ID values.

→ If STATUS is not "success":
  - → Extract `ERROR_MESSAGE` from reference file.
  - → Display ERROR_MESSAGE to user.
  - → Exit workflow immediately.

## 6. Summary

→ Display success summary with the following format:
```
✅ Commit created with project cost metrics in footer
   SHA: {COMMIT_SHA}

📊 Project cost metrics:
   Project: {SESSION_ID}
   (if COST_METHOD = "inc"):
      Cost since previous commit (since {COST_SINCE}):
   (if COST_METHOD = "cum"):
      Cost total, last {CLEANUP_PERIOD_DAYS} days:
   (for each model in CURRENT_COST array):
      • {model}: ${cost} = {in}in [+ {cacheWrites} cacheWrites] [+ {cacheReads} cacheReads] + {out}out
```

Where `{cacheWrites}` and `{cacheReads}` are only shown when the value is not `0`.
Cache values are already pre-abbreviated strings (e.g. `"213k"`) — display as-is.

```
```

→ Return to user.
