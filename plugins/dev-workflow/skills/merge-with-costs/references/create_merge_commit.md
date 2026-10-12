# Create Merge Commit

**IMPORTANT:** NEVER use `git commit` directly. Use the script.

---

## Execute Command

**Value Replacements:**
- `{{CURRENT_COST}}`: Literal JSON array from the cost step
- `{{COST_SINCE}}`: Anchor from the cost step (ISO date, or empty string if null)
- `{{COMMIT_SUBJECT}}`: Subject line from the message step
- `{{COMMIT_BODY}}`: Body from the message step
- `{{INCLUDED_SESSIONS}}`: Comma-joined ids from Step 2 (empty string if unset)

```bash
node "{{PLUGIN_ROOT}}/skills/merge-with-costs/scripts/merge-workflow.js" commit \
  --costs "{{CURRENT_COST}}" \
  --since "{{COST_SINCE}}" \
  --pooled "{{INCLUDED_SESSIONS}}" \
  <<'EOF'
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
EOF
```

The trailer carries `"method":"merge"`, the project `sessionId`, and `pooled` when sessions were
included, so the next `/commit-with-costs` here anchors against this merge commit.

## Parse JSON Output

→ `status` → STATUS

→ "success":
  - `data.commit_sha` → COMMIT_SHA

→ "no_merge_in_progress": MERGE_HEAD is gone; the merge was already committed or aborted.

→ "conflicts_unresolved": `data.unresolved` are still unmerged. Back to the conflict step.

→ "metrics_invalid", "git_error", or "error":
  - `message` → ERROR_MESSAGE
  - The merge remains staged. Tell the user it is still in progress.
