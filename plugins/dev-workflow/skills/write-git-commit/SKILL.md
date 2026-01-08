---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user mentions "commit", "commit my changes", "commit this", "save to git", "check in".
user-invocable: true
context: fork
allowed-tools:
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

This skill creates a git commit with a summary and optional body consisting for terse bullet points and git trailers for attribution and Claude cost metrics.

Activate when the user explicitly requests a git commit using phrases like:
- "commit my changes"
- "commit this"
- "save to git"
- "git commit"

---

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Order of Operations

This skill defines a very precise workflow that MUST be followed exactly.

**DO NOT SKIP** any section unless the instructions explicitly state "Go to Step [X]" or "Skip to Step [X]".

### B. Workflow Delegation Protocol

When step instructions say `DELEGATE_TO: [file]`:

1. **STOP** - Do not proceed based on assumed knowledge
2. **READ** - Use the Read tool to read the referenced file
3. **EXECUTE** - Follow the instructions in that file exactly
4. **VERIFY** - If a VERIFY checklist exists, confirm each item
5. **CONTINUE** - Only then proceed to the next step

**Why This Matters:**
Reference files contain formatting requirements, templates, and constraints not visible in SKILL.md. Skipping the read step causes incorrect workflow execution.

### C. Workflow Narration

Only narrate if a step has a defined "STEP_DESCRIPTION" 

BEFORE narrating any step, check:  
1. Does this step have a STEP_DESCRIPTION: field?
2. If YES → Narrate the STEP_DESCRIPTION value only
3. If NO → DO NOT narrate anything. Just execute WITHOUT a narration.

Examples of silent narration (just execute the steps, DO NOT print anything):
- Read delegation files per DELEGATE_TO instructions
- Executing sub-steps within a delegation
- Internal step processing without user-facing output

---

## 0. Prerequisites

**SKILL_NAME**: write-git-commit

**SESSION_ID**: !`cat .claude/settings.plugins.write-git-commit.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).sessionId' || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_BASE_DIR` is present, proceed with the workflow.

**NOTE:** If `SESSION_ID` shows "NOT_CONFIGURED" above, it will be resolved and saved to configuration in a later step.

**HOW TO EXECUTE BASH CODE IN THIS SKILL:**

When you see inline bash code blocks (```bash), you MUST:
- **TEXT SUBSTITUTION REQUIRED:** Replace `{{SKILL_BASE_DIR}}` with the literal path from "Base directory for this skill:" message
- **TEXT SUBSTITUTION REQUIRED:** Replace `{{SESSION_ID}}` with the literal session ID value
- These are TEMPLATE PLACEHOLDERS, not shell variables - perform textual substitution before execution
- Execute the substituted command using the Bash tool
- NEVER narrate execution. ALWAYS execute the code block command
- NEVER fabricate outputs (i.e. if the tool / command fails)

**Example:**
```
Template: node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare
After substitution: node "/Users/noahlz/.claude/plugins/.../write-git-commit/scripts/commit-workflow.js" prepare
```
 
## 1. Stage and Analyze Changes

### 1a. Stage changes

**STEP_DESCRIPTION**: "Staging changes"

→ Execute using Bash tool:
```bash
git add -A
```

### 1b. Analyze staged changes

**STEP_DESCRIPTION**: "Generating commit message"

→ Execute using Bash tool:
```bash
git diff --cached
```

## 2. Generate Commit Message

DELEGATE_TO: `references/message_guidelines.md`

Generate commit message following those guidelines.

**Mentally store (do NOT output or display):**
- `COMMIT_SUBJECT`: First line
- `COMMIT_BODY`: Remaining lines (may be empty)

Proceed silently to Step 3.

## 3. Display Message to User for Approval

BLOCKING: This step MUST complete with user approval before Step 4.

DELEGATE_TO: `references/message_approval.md`

→ Handle user response per reference file instructions
→ Extract `COMMIT_SUBJECT` and `COMMIT_BODY` if approved
→ Proceed to Step 4 only if approved by user

## 4. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`

**Quick Reference:**
- Execute commit-workflow.js prepare command
- Parse JSON output for session_id and current_cost
- Handle errors per reference file recovery procedures

⚠️ NOTE: Do NOT ever make a commit with missing or contrived cost metrics. If encountering errors with ccusage, IMMEDIATELY stop and ask user for guidance.

## 5. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

DELEGATE_TO: `references/create_commit.md`


**Quick Reference:**
- Execute commit-workflow.js commit command
- Pass session_id, costs, commit message via stdin
- Validate cost metrics before committing
- Parse commit SHA from output

## 6. Summary

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: `COMMIT_SHA`

📊 Session metrics:
   ID: `SESSION_ID`
   (for each model in `CURRENT_COST`): "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}"
```

✓ Done - Return to user
