---
name: merge-with-costs
description: Merge sub-agent worktree branches and create the merge commit with session cost metrics and Claude attribution. Use when the user asks to merge worktree or sub-agent branches with costs.
effort: low
allowed-tools:
  - AskUserQuestion
  - Bash(git *)
  - Bash(node *)
  - Read
  - Edit
  - Grep

---

Merge the branches a sub-agent development session left behind; record the project session's
cost in the merge commit.

Activate only on `/merge-with-costs` or a request to merge worktree/sub-agent branches with costs.
For an ordinary commit on the current branch, use `commit-with-costs`.

## SKILL_BASE_DIR: `${CLAUDE_SKILL_DIR}`

If the above shows literal `${CLAUDE_SKILL_DIR}`, halt: "Requires Claude Code 2.1.69+."

**Node.js Check**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-node-version.js"`
Halt if ERROR.

**Git Instructions Check**: !`node "${CLAUDE_SKILL_DIR}/../commit-with-costs/scripts/check-git-instructions.js"`
Display any WARNING before proceeding.

**Dependencies**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-dependencies.js" "${CLAUDE_SKILL_DIR}/../.."`

## Rules

| Rule | Behavior |
|------|----------|
| DELEGATE_TO | Read the referenced file; execute its instructions exactly. Never improvise or guess commands. |
| Narration | Narrate only STEP_DESCRIPTION steps; all others silent. |
| JSON outputs | Extract fields into variables (e.g. `data.candidates` → CANDIDATES). |
| Cost metrics | Never fabricate or estimate. Use only values from a successful `prepare-merge`. |
| Cost source | One session: the project root's. Never pool worktree sessions, never substitute another session. |
| Merge safety | Never run `git merge`, `git merge --abort`, `git rebase`, `git reset`, or `git add` directly. Only the scripts below. |
| Leaving mid-merge | Stopping after Step 3 without committing? Run the abort action and report. Never leave a staged merge behind. |

---

## Checklist

```
- [ ] 0. Pre-flight and config
- [ ] 1. Discover merge candidates
- [ ] 2. Confirm branches to merge
- [ ] 3. Stage the merge
- [ ] 4. Resolve conflicts (only when Step 3 reports them)
- [ ] 5. Generate commit message
- [ ] 6. Get user approval
- [ ] 7. Compute cost
- [ ] 8. Create merge commit
- [ ] 9. Display final summary
```

## 0. Pre-flight and Config

Halt if git commands already ran in this turn.

**SKILL_CONFIG**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.commit-with-costs.json"`

- `✓ Configuration found` → run the check below
- `NOT_CONFIGURED` → Halt: "Run `/commit-with-costs` once to create
  `.claude/settings.plugins.commit-with-costs.json`, then re-run this skill."

Share `commit-with-costs` configuration. Never create a second config file.

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" preflight \
  --config .claude/settings.plugins.commit-with-costs.json
```

| `status` | Action |
|----------|--------|
| `success` | Store `data.rerere_enabled` → RERERE_ENABLED. Step 1. |
| `in_worktree` | Halt with the message; re-run from `data.main_worktree_path`. |
| `session_mismatch` | Halt with the message. Fix: re-run from the configured session's directory, or correct `sessionId` in the config. |
| `error` | Display the message and halt. |

## 1. Discover Merge Candidates

**STEP_DESCRIPTION**: "Finding unmerged worktree branches"

DELEGATE_TO: `references/discover_branches.md`

- "success" → Step 2
- "no_candidates" → Halt: "No unmerged branches found."
- "merge_in_progress" → Halt with the returned message.
- Otherwise → Display error and halt.

## 2. Confirm Branches to Merge

Present CANDIDATES as a table: branch, commits ahead, worktree live?, own Claude session?

For each entry in UNACCOUNTED_SESSIONS, name the branch and its session directory and state
plainly: a Claude session ran inside that worktree, its cost belongs to that worktree's own
session, and this merge commit will not include it. Only work done from the project root —
including everything its sub-agents did inside worktrees — is counted.

Confirm with **AskUserQuestion**. Default to every candidate; let the user narrow the set or cancel.
With UNACCOUNTED_SESSIONS non-empty, make continuing an explicit choice against cancelling.
Store the confirmed list as BRANCHES. Halt on cancel.

## 3. Stage the Merge

**STEP_DESCRIPTION**: "Merging branches"

DELEGATE_TO: `references/perform_merge.md`

- "success" → Step 5
- "merge_conflicts" → Step 4
- "merge_failed" → already rolled back; report the message and halt.
- "nothing_to_merge" → halt, nothing to commit.
- Otherwise → display error and halt.

## 4. Resolve Conflicts

**STEP_DESCRIPTION**: "Resolving merge conflicts"

DELEGATE_TO: `references/resolve_conflicts.md`

- "resolved" → Step 5
- "aborted" → merge rolled back; report and halt.

## 5. Generate Commit Message

DELEGATE_TO: `../../references/message_guidelines.md`

Merge-specific overrides:

- COMMIT_SUBJECT: `Merge <branch>` for one branch, `Merge <n> sub-agent branches` for several.
- COMMIT_BODY: required. Summarize what the merged work accomplishes, drawn from the branch commit
  subjects and the staged diff. Name the merged branches, and any conflict Step 4 resolved and how.
- Never run `git add`. The merge already staged everything.

Read what is being merged:
```bash
git log --oneline HEAD..{{BRANCH}}
git diff --cached --stat
```

## 6. Get User Approval

DELEGATE_TO: `../../references/message_approval.md`

- "use_full" or "use_subject_only" → Step 7
- "request_revisions" → return to Step 5
- Cancel → run the abort action from `references/perform_merge.md`, then halt.

## 7. Compute Cost

**STEP_DESCRIPTION**: "Computing session cost metrics"

DELEGATE_TO: `references/fetch_merge_cost.md`

- "success" → store SESSION_ID, CURRENT_COST, COST_SINCE. Step 8.
- "no_anchor" → no earlier commit anchors this session, so the figure covers the whole session.
  Show the per-model totals and confirm with **AskUserQuestion**. On cancel, abort the merge and halt.
- Otherwise → display the error, abort the merge, halt. Cost metrics are required.

## 8. Create Merge Commit

**STEP_DESCRIPTION**: "Creating merge commit with cost metrics"

Verify CURRENT_COST and APPROVAL_STATUS both exist. If either is missing, abort the merge and exit.

DELEGATE_TO: `references/create_merge_commit.md`

- "success" → extract COMMIT_SHA. Step 9.
- Otherwise → display error, leave the merge staged, tell the user it is still in progress.

## 9. Display Final Summary

```
✅ Merge commit created with cost metrics
   SHA: {COMMIT_SHA}
   Merged: {BRANCHES}
   (if any conflicts were resolved in Step 4):
      Conflicts resolved: {paths}

📊 Project cost since {COST_SINCE}:
   Project: {SESSION_ID}
   (for each model in CURRENT_COST array):
      • {model}: ${cost} = {in}in [+ {cacheWrites} cacheWrites] [+ {cacheReads} cacheReads] + {out}out
   (if UNACCOUNTED_SESSIONS is non-empty):
      ⚠️  Not included: {branch} — worked on from a session inside its own worktree ({session_id})
```

Show `cacheWrites`/`cacheReads` only when non-zero. Cache values are pre-abbreviated strings –
display as-is. Stop here: what happens to the merged worktrees is the user's decision.
