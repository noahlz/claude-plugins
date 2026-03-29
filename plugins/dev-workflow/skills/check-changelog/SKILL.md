---
name: check-changelog
description: Check Claude Code changelog for updates since your last commit. Use when the user wants to see what changed in Claude Code.
context: fork
allowed-tools:
  - Bash(node *)
  - Bash(git *)
  - WebFetch
  - Read
  - Grep
  - Glob

---

Check for Claude Code updates relevant to the current project.

**MANDATORY** only activate this skill when the user invokes it directly (`/check-changelog`) OR asks about Claude Code updates. Examples:
- "check changelog"
- "what's new in Claude Code"
- "any Claude Code updates"

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

```
- [ ] 0. Prerequisites
- [ ] 1. Get last commit date
- [ ] 2. Fetch changelog
- [ ] 3. Parse changelog entries
- [ ] 4. Scan project context
- [ ] 5. Assess relevance
- [ ] 6. Present results
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

**Node.js Check**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-node-version.js"`

⛔ **HALT** if Node.js Check shows `ERROR`.

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Delegation Protocol

When you see `DELEGATE_TO: [file]`:
⛔ **STOP** → Use Read tool on the reference file path
→ Execute its instructions exactly
→ Return to SKILL.md only after completing reference file instructions

### B. Narration Control

⚠️  **SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently - no explanatory text.

### C. JSON Response Protocol

All script outputs return JSON. Extract fields and store in variables:
- Syntax: `json.field.path` → VARIABLE_NAME

---

# Skill Workflow Instructions

## 0. Prerequisites

⛔ **HALT if TRUE**: WebFetch tool is not available. Tell user: "This skill requires the WebFetch tool to fetch the Claude Code changelog."
✅ **CONTINUE if TRUE**: WebFetch is available.

## 1. Get Last Commit Date

**STEP_DESCRIPTION**: "Checking last commit date"

→ Execute using Bash tool:
```bash
node "${CLAUDE_SKILL_DIR}/scripts/get-last-commit-date.js"
```

→ Parse JSON output.

→ If `status` = "success":
  - `data.date` → LAST_COMMIT_DATE
  - `data.dateShort` → LAST_COMMIT_DATE_SHORT
  - `data.sha` → LAST_COMMIT_SHA
  - `data.message` → LAST_COMMIT_MESSAGE
  - → Proceed to Step 2.

→ If `status` = "error":
  - Set LAST_COMMIT_DATE_SHORT to a date 30 days ago from today
  - Set NO_COMMITS = true
  - → Proceed to Step 2 with note: "No commits found — showing recent versions."

## 2. Fetch Changelog

**STEP_DESCRIPTION**: "Fetching Claude Code changelog"

→ Use WebFetch tool to fetch:
```
https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
```

→ Store full response text as CHANGELOG_RAW.

→ If WebFetch fails:
  - ⛔ HALT: "Failed to fetch Claude Code changelog. Check your network connection."

→ Proceed to Step 3.

## 3. Parse Changelog Entries

DELEGATE_TO: `references/parse-changelog.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract CHANGELOG_ENTRIES per reference file instructions.

→ If CHANGELOG_ENTRIES is empty and NO_COMMITS is not set:
  - → Skip to Step 6 with message: "You're up to date! No new Claude Code versions since your last commit on LAST_COMMIT_DATE_SHORT."

→ Proceed to Step 4.

## 4. Scan Project Context

**STEP_DESCRIPTION**: "Scanning project for context"

→ Execute using Bash tool:
```bash
node "${CLAUDE_SKILL_DIR}/scripts/scan-project-context.js"
```

→ Parse JSON output.

→ If `status` = "success":
  - `data` → PROJECT_CONTEXT
  - → Proceed to Step 5.

→ If `status` = "error":
  - Set PROJECT_CONTEXT to empty object
  - → Proceed to Step 5 (relevance assessment will be generic).

## 5. Assess Relevance

DELEGATE_TO: `references/assess-relevance.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract ACTIONABLE_ITEMS per reference file instructions.

→ Proceed to Step 6.

## 6. Present Results

**STEP_DESCRIPTION**: "Presenting Claude Code updates"

→ If "up to date" message was set in Step 3, display it and exit.

→ Otherwise, display results in this format:

```
## Claude Code Updates Since [LAST_COMMIT_DATE_SHORT]
(Last commit: [LAST_COMMIT_SHA] — [LAST_COMMIT_MESSAGE])

### [version] (date)
**Added:** ...
**Fixed:** ...
**Changed:** ...
(other categories as present)

### [version] (date)
...

---

## Most Actionable for This Project

1. **[HIGH]** Description → Why it matters for this project
2. **[MEDIUM]** Description → Why it matters
...
```

→ If NO_COMMITS is set, prepend: "⚠️ No commits found in this repo. Showing the 3 most recent Claude Code versions."

→ If ACTIONABLE_ITEMS is empty, replace the "Most Actionable" section with: "No changes specifically relevant to this project's configuration were identified."

→ Return to user.
