---
name: commit-with-costs
description: Create a git commit with trailers for session cost metrics and Claude attribution. Use when the user asks you to commit changes to git.
effort: low
allowed-tools:
  - AskUserQuestion
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

Create a git commit with cost metric trailers and Claude attribution.

Activate only when user invokes `/commit-with-costs` or asks to commit with costs (e.g. "commit with costs", "commit and track costs").

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`
**PLUGIN_ROOT**: `${CLAUDE_PLUGIN_ROOT}`

**Node.js Check**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/check-node-version.js"`
Halt if ERROR.

**Git Instructions Check**: !`node "${CLAUDE_SKILL_DIR}/scripts/check-git-instructions.js"`
Display any WARNING before proceeding.

**Dependencies**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/check-dependencies.js" "${CLAUDE_PLUGIN_ROOT}"`

## Rules

| Rule | Behavior |
|------|----------|
| DELEGATE_TO | Read the referenced file; execute its instructions exactly. Never improvise or guess commands. |
| Narration | Narrate only STEP_DESCRIPTION steps; all others silent. |
| JSON outputs | Extract fields into variables (e.g. `data.session_id` → SESSION_ID). |
| Cost metrics | Never fabricate or estimate. Only use values from successful ccusage execution. |

---

## Checklist

```
- [ ] 0. Pre-flight and config
- [ ] 1. Resolve SessionID
- [ ] 2. Detect or Generate Commit Message
- [ ] 3. Get User Approval
- [ ] 4. Fetch Cost Data
- [ ] 5. Create commit
- [ ] 6. Display Final Summary
```

## 0. Pre-flight and Config

Halt if git commands already ran in this turn.

**SKILL_CONFIG**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/skill-config.js" check commit-with-costs`

- Starts with `✓ Configuration found` → Step 1a
- Starts with `NOT_CONFIGURED` → Step 1b

Config lives at the project root. Access it only via `skill-config.js`, never by relative path.

## 1. Resolve SessionID

### 1a. Load existing configuration

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/skill-config.js" read commit-with-costs
```

Extract `config.sessionId` → SESSION_ID. Proceed to Step 2.

### 1b. Create new configuration

Display: "Configuration not found ({{path from SKILL_CONFIG}}). Let's create it."

```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" list-sessions
```

Extract `data.sessions`. Use AskUserQuestion: "Select a Claude Code session:" with first 4 session IDs as options.

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/skill-config.js" write commit-with-costs '{"sessionId":"{{SELECTED_SESSION_ID}}"}'
```

- `created` → inform user of `path`.
- `exists` → keep it; never overwrite. Step 1a.

## 2. Detect or Generate Commit Message

Check conversation for an existing `Proposed commit message:` block (e.g. from `/preview-commit-message`).

**If found:** Extract COMMIT_SUBJECT and COMMIT_BODY from the ━━━-delimited block. Skip to Step 3.

**If not found:**

DELEGATE_TO: `${CLAUDE_PLUGIN_ROOT}/references/stage_and_analyze.md`

DELEGATE_TO: `${CLAUDE_PLUGIN_ROOT}/references/message_guidelines.md`

Store COMMIT_SUBJECT and COMMIT_BODY. Produce no output yet — the message is displayed in Step 3 via the AskUserQuestion `question` field.

## 3. Get User Approval

Obtain user approval via **AskUserQuestion** before proceeding. The commit message MUST be embedded in the question field (see reference) — this overrides the Narration silent rule.

DELEGATE_TO: `${CLAUDE_PLUGIN_ROOT}/references/message_approval.md`

- "use_full" or "use_subject_only" → Step 4
- "request_revisions" → return to Step 2

## 4. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

DELEGATE_TO: `references/fetch_cost.md`

**If FETCH_STATUS = "success":** Store SESSION_ID, CURRENT_COST, COST_METHOD, COST_SINCE, CLEANUP_PERIOD_DAYS. Proceed to Step 5.

**If not "success":** Display error. Halt: cost metrics are required.

## 5. Create Commit

**STEP_DESCRIPTION**: "Creating git commit with cost metrics"

Verify SESSION_ID, CURRENT_COST, and APPROVAL_STATUS all exist. If any missing, exit.

DELEGATE_TO: `references/create_commit.md`

**If STATUS = "success":** Extract COMMIT_SHA. Proceed to Step 6.
**If not:** Display error. Exit.

## 6. Display Final Summary

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

Only show `cacheWrites`/`cacheReads` when non-zero. Cache values are pre-abbreviated strings – display as-is.
