# Resolve Merge Conflicts

The merge is staged with MERGE_HEAD set. Resolve every conflicted path, or abort.

**IMPORTANT:** NEVER run `git add`, `git merge --continue`, or `git checkout --ours/--theirs`.
Stage only through the script.

---

## 1. Report What Is Already Settled

Name the RERERE_RESOLVED paths: a recorded resolution was replayed onto them and they are
staged. Say so explicitly — the user is entitled to know a resolution was reused.

If RERERE_ENABLED is false, say once that `git config rerere.enabled true` records these
resolutions for next time. Do not set it.

## 2. Resolve Each Remaining Path

For each path in UNRESOLVED, one at a time:

1. Read the file; locate the `<<<<<<<` / `=======` / `>>>>>>>` blocks.
2. Show the conflicting hunks; state the resolution you propose and why.
3. Get approval with **AskUserQuestion**: apply the proposal, take one side whole, or abort.
4. Apply it with **Edit**, removing every conflict marker.

Never invent content that is in neither side unless the user asks for it.

## 3. Stage the Resolutions

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" stage-resolved --paths "{{PATHS}}"
```

`{{PATHS}}`: comma-separated resolved paths. Omit the flag to stage everything marker-free.

→ `status` → STATUS

→ "success":
  - `data.remaining` → REMAINING. Empty → return "resolved". Otherwise back to section 2.

→ "markers_present": `data.unresolved` still hold markers, nothing was staged. Fix and retry.

→ "nothing_to_stage" or "no_merge_in_progress": report and stop.

## Aborting

The user may stop at any point. Roll the merge back and return "aborted":

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" abort
```
