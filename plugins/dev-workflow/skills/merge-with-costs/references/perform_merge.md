# Stage the Merge

**IMPORTANT:** NEVER run `git merge`, `git merge --abort`, or `git add` directly. Use the script.

---

## Execute Command

**Value Replacements:**
- `{{BRANCHES}}`: Confirmed branch names, comma-separated, no spaces

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" merge --branches "{{BRANCHES}}"
```

Two or more branches produce an octopus merge. A failed octopus has already fast-forwarded to
its first branch, leaving nothing safe to resolve, so the script rolls it back.

## Parse JSON Output

→ `status` → STATUS

→ "success": merge staged, MERGE_HEAD set, nothing committed.
  - `data.branches` → BRANCHES
  - `data.resolved_by_rerere` → RERERE_RESOLVED (paths a recorded resolution settled and staged;
    report them, they are part of the merge)

→ "merge_conflicts": merge staged and waiting; nothing was aborted.
  - `data.unresolved` → UNRESOLVED (paths still holding conflict markers)
  - `data.resolved_by_rerere` → RERERE_RESOLVED (already staged)
  - `data.rerere_enabled` → RERERE_ENABLED
  - Go to the conflict resolution step.

→ "merge_failed": nothing staged, working tree clean.
  - Report `message`. For several branches, re-run the skill one branch at a time.

→ "nothing_to_merge": no merge commit produced.

## Aborting

Whenever the workflow stops after a `merge` without committing:

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" abort
```
