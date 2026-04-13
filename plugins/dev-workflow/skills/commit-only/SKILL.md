Commit staged changes with an LLM-generated message. No cost metrics.
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

Create a git commit with Claude attribution.

Activate only when user invokes `/commit-only` or asks to commit (e.g. "commit", "commit my changes", "just commit", "commit without costs").

## SKILL_BASE_DIR: `${CLAUDE_SKILL_DIR}`

If the above shows literal `${CLAUDE_SKILL_DIR}`, halt: "Requires Claude Code 2.1.69+."

## Rules

- **DELEGATE_TO**: Execute the referenced file's instructions, then return.
- **Narration**: Only narrate steps marked STEP_DESCRIPTION. Execute all others silently — do NOT output or summarize intermediate values.

---

## Checklist

```
- [ ] 0. Pre-flight check
- [ ] 1. Detect or generate commit message
- [ ] 2. Get user approval
- [ ] 3. Create commit
- [ ] 4. Display summary
```

## 0. Pre-flight check

Halt if git commands already ran in this turn.

## 1. Detect or Generate Commit Message

Check conversation for an existing `Proposed commit message:` block (e.g. from `/preview-commit-message`).

**If found:** Extract COMMIT_SUBJECT and COMMIT_BODY from the ━━━-delimited block. Skip to Step 2.

**If not found:**

DELEGATE_TO: `../../references/stage_and_analyze.md`

DELEGATE_TO: `../../references/message_guidelines.md`

Store COMMIT_SUBJECT and COMMIT_BODY. **SILENT STEP**: Produce no output. The first visible output in this workflow is the `Proposed commit message:` block in Step 2.

## 2. Get User Approval

Obtain user approval via **AskUserQuestion** (NOT plain-text) before proceeding.

DELEGATE_TO: `../../references/message_approval.md`

- "use_full" or "use_subject_only" → Step 3
- "request_revisions" → return to Step 1

## 3. Create Commit

**STEP_DESCRIPTION**: "Creating git commit"

Verify APPROVAL_STATUS is "use_full" or "use_subject_only". If not, exit.

**If COMMIT_BODY is non-empty:**
```bash
git commit -m "{{COMMIT_SUBJECT}}" -m "{{COMMIT_BODY}}"
```

**If COMMIT_BODY is empty:**
```bash
git commit -m "{{COMMIT_SUBJECT}}"
```

```bash
git rev-parse --short HEAD  # store as COMMIT_SHA
```

If git commit fails, display the error and exit.

## 4. Display Summary

```
✅ Committed: {COMMIT_SHA}
   {COMMIT_SUBJECT}
```
