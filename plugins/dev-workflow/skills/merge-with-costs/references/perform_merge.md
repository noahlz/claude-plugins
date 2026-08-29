# Stage the Merge

**IMPORTANT:** NEVER run `git merge` or `git merge --abort` directly. Use the script.

---

## Execute Command

**Value Replacements:**
- `{{BRANCHES}}`: Confirmed branch names, comma-separated, no spaces

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" merge --branches "{{BRANCHES}}"
```

Two or more branches produce an octopus merge. Octopus refuses to run at all if any branch
conflicts — there is no partial result to resolve. The script aborts for you on failure.

## Parse JSON Output

→ `status` → STATUS

→ "success": merge staged, MERGE_HEAD set, nothing committed.
  - `data.branches` → BRANCHES

→ "merge_failed": already aborted, working tree clean.
  - `data.conflicts` → CONFLICTS (paths)
  - Report the conflicting paths; tell the user to merge those branches by hand.

→ "nothing_to_merge": no merge commit produced.

## Aborting

Whenever the workflow stops after a successful `merge` without committing:

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" abort
```
