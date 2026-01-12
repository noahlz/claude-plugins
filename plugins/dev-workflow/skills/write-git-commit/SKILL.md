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

## Workflow

```
Stage → Generate → [User Approval] → Fetch Costs → Commit → Summary
              ↑______________|
              (revision loop)
```

Step 3 blocks until user approves the commit message.

---

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Order of Operations

- Follow the Workflow instructions **EXACTLY** as written. 
- **DO NOT SKIP** any section unless the instructions explicitly state "Go to Step [X]" or "Skip to Step [X]".
- This Workflow is **interactive**. You must ALWAYS get user approval per Step 3 before proceeding to the next step.

### B. Delegation Protocol

When you see `DELEGATE_TO: [file]`:
1. Read the referenced file
2. Execute its instructions exactly
3. Check any VERIFY checklists
4. Return to continue the workflow

Reference files contain detailed requirements. ALWAYS read them when cited.

### C. Narration Control

Only narrate steps that have a `STEP_DESCRIPTION` field. Use that exact text.

Steps without STEP_DESCRIPTION are silent - execute without output. Do not narrate section names, file reads, or internal processing.

## Workflow Checklist

**Use this copyable checklist to accurately follow ALL steps of this skill workflow:**

```
- [ ] Resolve and Save sessionId (if necessary)
- [ ] Stage and analyze changes
- [ ] Generate commit message
- [ ] Get user approval
- [ ] Fetch session costs
- [ ] Create commit
- [ ] Display summary
```

## Skill Organization

**References:**
- [`create_commit.md`](./references/create_commit.md) - Git commit creation
- [`fetch_cost.md`](./references/fetch_cost.md) - Session cost retrieval
- [`message_approval.md`](./references/message_approval.md) - User approval workflow
- [`message_guidelines.md`](./references/message_guidelines.md)- Commit message format
- [`session_recovery.md`](./references/session_recovery.md) - Session ID fallback

**Scripts:**  [scripts/](./scripts/) - utility scripts

---

## 0. Prerequisites

**SKILL_NAME**: write-git-commit

**SESSION_ID**: !`cat .claude/settings.plugins.write-git-commit.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).sessionId' || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_BASE_DIR` is present, display it then proceed with the workflow.

**NOTE:** If `SESSION_ID` shows "NOT_CONFIGURED" above, it will be resolved and saved to configuration in a later step.

**Template Substitution:**

Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Literal path from "Base directory for this skill:"
- `{{SESSION_ID}}` → Literal session ID value

Example: 
- Skill header states: `Base directory for this skill: /Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit`
- `SKILL_BASE_DIR` stored as value `/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit`
- `node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js"` becomes `node "/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit/scripts/commit-workflow.js"`

## 1. Resolve SessionID

IF the `SESSION_ID` as found, proceed immediately to Step 2.

OTHERWISE if the `SESSION_ID` value was `NOT_CONFIGURED` resolve and save it as follows:
  - Execute using Bash tool to get available sessions:
    ```bash
    node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" list-sessions
    ```
  - Parse JSON output to extract sessions array from `data.sessions`
  - Build AskUserQuestion with dynamic options:
    - For each session in first 4 from sessions array: Create option with label = sessionId
  - If user picks a session:
    - Save to config using save-config command:
      ```bash
      node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" save-config "$(pwd)" "{{SELECTED_SESSION_ID}}"
      ```
    - Continue workflow.

If you encounter an error in the above procedure, exit the workflow.
 
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

Generate commit message following those guidelines.

**Silent generation:** Create message internally. First output must be "Proposed commit message:" in Step 4.

## 4. Display Message to User for Approval

BLOCKING: This step MUST complete with user approval before Step 5.

DELEGATE_TO: `references/message_approval.md`

→ Handle user response per reference file instructions  
→ Extract `COMMIT_SUBJECT` and `COMMIT_BODY` if approved  
→ Proceed to Step 4 only if approved by user  

## 5. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`

⚠️  **NOTE:** Do NOT ever make a commit with missing or contrived cost metrics. If encountering errors with ccusage, IMMEDIATELY STOP and ask user for guidance.

## 6. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

DELEGATE_TO: `references/create_commit.md`

## 7. Summary

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: `COMMIT_SHA`

📊 Session metrics:
   ID: `SESSION_ID`
   (for each model in `CURRENT_COST`): "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}"
```

✓ Done - Return to user
