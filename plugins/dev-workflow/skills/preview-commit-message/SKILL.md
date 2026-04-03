---
name: preview-commit-message
description: Preview a commit message from staged changes without committing. Use when the user asks to write, draft, or preview a commit message.
model: sonnet
context: fork
allowed-tools:
  - Bash(git *)
  - Read
  - Grep

---

Use this skill to draft a commit message from staged changes without actually committing.

**MANDATORY** only activate this skill when the user invokes it directly (`/preview-commit-message`) OR prompts you to draft a message. Examples:
- "write a commit message"
- "draft a commit message"
- "preview a commit message"
- "prepare a commit message"

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

**Use this copyable checklist to ensure you follow ALL steps of this skill workflow:**

```
- [ ] 0. Pre-flight check
- [ ] 1. Stage and analyze changes
- [ ] 2. Generate commit message
- [ ] 3. Display proposed message
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Delegation Protocol

When you see `DELEGATE_TO: [file]`:
> **STOP** -> Use Read tool on the reference file path
> Execute its instructions exactly (bash commands, parsing, etc.)
> Return to SKILL.md only after completing reference file instructions

**IMPORTANT:** Reference files contain Bash tool commands - use them exactly as written - never improvise commands.

### B. Narration Control

**SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently - no explanatory text.

---

# Skill Workflow Instructions

## 0. Pre-Flight Check

**HALT if TRUE**: Already ran `git status/diff/log` in parallel OR drafted commit message OR executing system git workflow. STOP skill immediately.
**CONTINUE if TRUE**: No git commands executed yet. Continue.

## 1. Stage and Analyze Changes

DELEGATE_TO: `../../references/stage_and_analyze.md`
> READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

## 2. Generate Commit Message

DELEGATE_TO: `../../references/message_guidelines.md`
> READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

> Extract COMMIT_SUBJECT and COMMIT_BODY per the reference file instructions.
> **Do NOT display the commit message here.** It will be displayed in Step 3.
> Proceed to Step 3.

## 3. Display Proposed Message

**STEP_DESCRIPTION**: "Displaying proposed commit message"

> Display the proposed message:
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> Inform the user: "This message has NOT been committed. Use `/commit-only` to commit, or `/commit-with-costs` to commit with cost metrics."

> Return to user.
