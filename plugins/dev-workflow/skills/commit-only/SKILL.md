---
name: commit-only
description: Commit staged changes with an AI-generated message. No cost metrics. Use when the user asks to commit without cost tracking.
model: sonnet
allowed-tools:
  - AskUserQuestion
  - Bash(git *)
  - Read
  - Grep

---

Use this skill to commit staged changes with an AI-generated message. No cost metrics are attached.

**MANDATORY** only activate this skill when the user invokes it directly (`/commit-only`) OR prompts you to commit. Examples:
- "[git] commit"
- "commit [this | my changes | to git]"
- "save to git"
- "commit without costs"
- "just commit"

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

**Use this copyable checklist to ensure you follow ALL steps of this skill workflow:**

```
- [ ] 0. Pre-flight check
- [ ] 1. Detect or generate commit message
- [ ] 2. Get user approval using AskUserQuestion
- [ ] 3. Create commit
- [ ] 4. Display summary
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

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

---

# Skill Workflow Instructions

## 0. Pre-Flight Check

⛔ **HALT if TRUE**: Already ran `git status/diff/log` in parallel OR executing system git workflow. STOP skill immediately.
✅ **CONTINUE if TRUE**: No git commands executed yet. Continue.

## 1. Detect or Generate Commit Message

**Check conversation context:** Look for a `Proposed commit message:` block already present in this conversation (e.g., output from `/preview-commit-message`).

**If a proposed message IS found in the conversation:**
→ Extract COMMIT_SUBJECT (the line immediately after the ━━━ separator)
→ Extract COMMIT_BODY (any remaining lines before the closing ━━━ separator, or empty string if none)
→ **Do NOT display or echo the extracted message.** It will be displayed in Step 2.
→ Skip directly to Step 2 (approval).

**If NO proposed message is found:**
→ Stage and analyze:

DELEGATE_TO: `../../references/stage_and_analyze.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Generate commit message:

DELEGATE_TO: `../../references/message_guidelines.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract COMMIT_SUBJECT and COMMIT_BODY per the reference file instructions.
→ **Do NOT display the commit message here.** It will be displayed in Step 2.
→ Proceed to Step 2.

## 2. Get User Approval using AskUserQuestion

**BLOCKING:** Requires user approval before Step 3.

DELEGATE_TO: `../../references/message_approval.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

→ Extract APPROVAL_STATUS and updated COMMIT_SUBJECT and COMMIT_BODY per reference file instructions.

→ If APPROVAL_STATUS = "use_full" or "use_subject_only": Proceed to Step 3.
→ If APPROVAL_STATUS = "request_revisions": Return to Step 1 to regenerate message.

## 3. Create Commit

**STEP_DESCRIPTION**: "Creating git commit"

**MANDATORY:** Verify APPROVAL_STATUS is "use_full" OR "use_subject_only" before proceeding. If not: exit workflow immediately.

**If COMMIT_BODY is non-empty:**
```bash
git commit -m "{{COMMIT_SUBJECT}}" -m "{{COMMIT_BODY}}"
```

**If COMMIT_BODY is empty:**
```bash
git commit -m "{{COMMIT_SUBJECT}}"
```

→ Parse stdout to extract COMMIT_SHA:
```bash
git rev-parse --short HEAD
```

→ Store result as COMMIT_SHA.

→ If git commit fails: display the error output to the user and exit workflow.

## 4. Summary

→ Display:
```
✅ Committed: {COMMIT_SHA}
   {COMMIT_SUBJECT}
```

→ Return to user.
