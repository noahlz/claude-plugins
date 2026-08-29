---
name: merge-with-costs
description: Merge sub-agent worktree branches and create the merge commit with pooled cost metrics and Claude attribution. Use when the user asks to merge worktree or sub-agent branches with costs.
effort: low
allowed-tools:
  - AskUserQuestion
  - Bash(git *)
  - Bash(node *)
  - Read
  - Grep

---

Merge the branches a sub-agent development session left behind. Record the cost of every
contributing session — each worktree plus the orchestrator — in one merge commit.

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
| Merge safety | Never run `git merge`, `git merge --abort`, `git rebase`, or `git reset` directly. Only the scripts below. |
| Leaving mid-merge | Stopping after Step 3 without committing? Run the abort action and report. Never leave a staged merge behind. |

---

## Checklist

```
- [ ] 0. Pre-flight and config
- [ ] 1. Discover merge candidates
- [ ] 2. Confirm branches to merge
- [ ] 3. Stage the merge
- [ ] 4. Generate commit message
- [ ] 5. Get user approval
- [ ] 6. Pool cost data
- [ ] 7. Create merge commit
- [ ] 8. Display final summary
```

## 0. Pre-flight and Config

Halt if git commands already ran in this turn.

**SKILL_CONFIG**: !`node "${CLAUDE_SKILL_DIR}/../../lib/check-skill-config.js" "./.claude/settings.plugins.commit-with-costs.json"`

- `✓ Configuration found` → Step 1
- `NOT_CONFIGURED` → Halt: "Run `/commit-with-costs` once to create
  `.claude/settings.plugins.commit-with-costs.json`, then re-run this skill."

Share `commit-with-costs` configuration. Never create a second config file.

## 1. Discover Merge Candidates

**STEP_DESCRIPTION**: "Finding unmerged worktree branches"

DELEGATE_TO: `references/discover_branches.md`

- "success" → Step 2
- "no_candidates" → Halt: "No unmerged branches found."
- "merge_in_progress" → Halt with the returned message.
- Otherwise → Display error and halt.

## 2. Confirm Branches to Merge

Present CANDIDATES as a table: branch, commits ahead, worktree live?, cost data found?

State explicitly that any candidate with `has_cost_data: false` has lost its worktree transcripts —
its cost is unrecoverable and will be missing from the merge commit.

Confirm with **AskUserQuestion**. Default to every candidate; let the user narrow the set or cancel.
Store the confirmed list as BRANCHES. Halt on cancel.

## 3. Stage the Merge

**STEP_DESCRIPTION**: "Merging branches"

DELEGATE_TO: `references/perform_merge.md`

- "success" → Step 4
- "merge_failed" → already aborted; report the conflicting paths and halt.
- "nothing_to_merge" → Halt: nothing to commit.
- Otherwise → Display error and halt.

## 4. Generate Commit Message

DELEGATE_TO: `../../references/message_guidelines.md`

Merge-specific overrides:

- COMMIT_SUBJECT: `Merge <branch>` for one branch, `Merge <n> sub-agent branches` for several.
- COMMIT_BODY: required, not optional. Summarize what the merged work accomplishes, drawn from the
  branch commit subjects and the staged diff. Name the merged branches.
- Never run `git add`. The merge already staged everything.

Read what is being merged:
```bash
git log --oneline HEAD..{{BRANCH}}
git diff --cached --stat
```

## 5. Get User Approval

DELEGATE_TO: `../../references/message_approval.md`

- "use_full" or "use_subject_only" → Step 6
- "request_revisions" → return to Step 4
- Cancel → run the abort action from `references/perform_merge.md`, then halt.

## 6. Pool Cost Data

**STEP_DESCRIPTION**: "Pooling session cost metrics"

DELEGATE_TO: `references/fetch_merge_cost.md`

- "success" → store CURRENT_COST, COST_SINCE, CONTRIBUTIONS, UNRESOLVED. Proceed to Step 7.
- Otherwise → display the error, abort the merge, halt. Cost metrics are required.

## 7. Create Merge Commit

**STEP_DESCRIPTION**: "Creating merge commit with pooled cost metrics"

Verify CURRENT_COST and APPROVAL_STATUS both exist. If either is missing, abort the merge and exit.

DELEGATE_TO: `references/create_merge_commit.md`

- "success" → extract COMMIT_SHA. Proceed to Step 8.
- Otherwise → display error, leave the merge staged, tell the user it is still in progress.

## 8. Display Final Summary

```
✅ Merge commit created with pooled cost metrics
   SHA: {COMMIT_SHA}
   Merged: {BRANCHES}

📊 Pooled cost by session:
   (for each entry in CONTRIBUTIONS):
      • {label}: ${cost}
   (if UNRESOLVED is non-empty):
      ⚠️  No cost data recovered for: {branches} — worktree transcripts were already deleted

📊 Total by model (orchestrator counted since {COST_SINCE}):
   (for each model in CURRENT_COST array):
      • {model}: ${cost} = {in}in [+ {cacheWrites} cacheWrites] [+ {cacheReads} cacheReads] + {out}out
```

Show `cacheWrites`/`cacheReads` only when non-zero. Cache values are pre-abbreviated strings –
display as-is.

Close by telling the user the merged worktrees can now be removed: their costs are in the commit,
and Claude Code deletes a worktree's transcripts when the worktree goes away.
