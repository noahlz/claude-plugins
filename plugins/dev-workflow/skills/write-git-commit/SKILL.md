---
name: write-git-commit
description: Creates git commits with session cost metrics and Claude attribution as git trailers. Use when committing changes or saving work to git.
user-invocable: true
context: fork
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

You use this skill - with interactive input from the user - to create a git commit with a summary and optional body consisting of terse bullet points and git trailers for attribution and Claude cost metrics.

Activate when the user explicitly requests a git commit using phrases like:
- "commit my changes"
- "commit this"
- "save to git"
- "git commit"

**DO NOT** use this skill autonomously - only activate it when requested or invoked by the user.

---

# Skill Context 

## Reference Files 

**References:**
- [`create_commit.md`](./references/create_commit.md) - Git commit creation
- [`fetch_cost.md`](./references/fetch_cost.md) - Session cost retrieval
- [`message_approval.md`](./references/message_approval.md) - User approval workflow
- [`message_guidelines.md`](./references/message_guidelines.md) - Commit message format

**Scripts:**  [scripts/](./scripts/) - utility scripts

## Workflow Diagram and Checklist

This skill follows a precise workflow:

```
(1) Check SessionId → (2) Stage → (3) Generate → (4) [User Approval] → (5) Fetch Costs → (6) Commit → (7) Summary
                                            ↑____________________|
                                                (revision loop)
```

Step 4 **MUST** block until user approves the commit message. **Do NOT COMMIT without approval!**

**Use this copyable checklist to accurately follow ALL steps of this skill workflow:**

```
- [ ] 1. Resolve and Save sessionId (if necessary)
- [ ] 2. Stage and analyze changes
- [ ] 3. Generate commit message
- [ ] 4. Get user approval
- [ ] 5. Fetch session costs
- [ ] 6. Create commit
- [ ] 7. Display summary
```

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Order of Operations

→ Follow the Workflow instructions **EXACTLY** as written.  
→ **DO NOT SKIP** any section unless the instructions explicitly state "Go to Step [X]".  
→ This Workflow is **interactive**. You must ALWAYS get user approval per Step 4 before proceeding.  

### B. Delegation Protocol

When you see `DELEGATE_TO: [file]`:  
→ Read the referenced file.  
→ Execute its instructions exactly.  
→ Return to continue with navigation logic in this file.  

Reference files contain detailed requirements. ALWAYS read them when cited.

### C. Narration Control

→ Only narrate steps that have a `STEP_DESCRIPTION` field. Use that exact text.  
→ Steps without STEP_DESCRIPTION are silent - execute without output.  

⚠️ **SILENCE PROTOCOL**  
Only narrate steps with a STEP_DESCRIPTION field. All other tool calls execute silently - no explanatory text.

---

# Skill Workflow Instructions

## 0. Prerequisites

**SKILL_NAME**: write-git-commit

**SESSION_ID**: !`cat .claude/settings.plugins.write-git-commit.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).sessionId' || echo "NOT_CONFIGURED"`

---

→ At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" message and store it for use in bash commands.  
→ If `SKILL_BASE_DIR` is present, display it then proceed with Step 1.  

**NOTE:** If `SESSION_ID` shows "NOT_CONFIGURED", it will be resolved in Step 1.

**Template Substitution:**

Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Literal path from "Base directory for this skill:"
- `{{SESSION_ID}}` → Literal session ID value

Example:
- Skill header states: `Base directory for this skill: /Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit`
- `SKILL_BASE_DIR` stored as: `/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit`
- `node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js"` becomes: `node "/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit/scripts/commit-workflow.js"`

## 1. Resolve SessionID

→ If `SESSION_ID` is configured (not "NOT_CONFIGURED"): Skip to Step 2.  
→ If `SESSION_ID` is "NOT_CONFIGURED": Execute the following:  

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

→ If save succeeds: Continue to Step 2.  
→ If error occurs: Display error message to user and exit workflow immediately.  

## 2. Stage and Analyze Changes

### 2a. Stage changes

**STEP_DESCRIPTION**: "Staging changes"

→ Execute using Bash tool:
```bash
git add -A
```

### 2b. Analyze staged changes

**STEP_DESCRIPTION**: "Generating commit message"

→ Execute using Bash tool:
```bash
git diff --cached
```

## 3. Generate Commit Message

DELEGATE_TO: `references/message_guidelines.md`

→ Extract COMMIT_SUBJECT and COMMIT_BODY from reference file output.
→ Proceed to Step 4.  

## 4. Display Message to User for Approval

BLOCKING: This step MUST complete with user approval before Step 5.

DELEGATE_TO: `references/message_approval.md`

→ Extract APPROVAL_STATUS, COMMIT_SUBJECT, and COMMIT_BODY from reference file output (subject and body may be modified).  

→ If APPROVAL_STATUS = "use_full" or "use_subject_only": Proceed to Step 5.  
→ If APPROVAL_STATUS = "request_revisions": Return to Step 3 to regenerate message.  

## 5. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`

→ Extract FETCH_STATUS from reference file output.

→ If FETCH_STATUS = "success":  
  - → Extract `SESSION_ID` from reference file.  
  - → Extract `CURRENT_COST` from reference file (validated JSON array).  
  - → Proceed to Step 6 with SESSION_ID and CURRENT_COST values.  

→ If FETCH_STATUS is not "success":
  - → Extract `ERROR_MESSAGE` from reference file.
  - → Display error message to user.
  - → Tell user "*** Session ID must be configured to accurately extract Claude Code cost metrics. Cannot create commit without valid cost metrics."
  - → HALT WORKFLOW - Do NOT proceed to Step 6 under any circumstances.

## 6. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

**IMPORTANT:** Before proceeding, verify:
- APPROVAL_STATUS = "use_full" OR "use_subject_only" (from Step 4). If APPROVAL_STATUS has any other value: Exit workflow immediately.
- SESSION_ID and CURRENT_COST are present from Step 5. If either is missing: Display error "Cannot proceed without session ID and cost metrics" and exit workflow immediately.
- Do NOT fabricate or estimate cost metrics under any circumstances.

DELEGATE_TO: `references/create_commit.md`

→ Extract STATUS from reference file output.

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
