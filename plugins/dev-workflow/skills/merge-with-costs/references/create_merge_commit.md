# Create Merge Commit

**IMPORTANT:** NEVER use `git commit` directly. Use the script.

---

## Execute Command

**Value Replacements:**
- `{{CURRENT_COST}}`: Literal JSON array from the cost step
- `{{COST_SINCE}}`: Anchor from the cost step (ISO date, or empty string if null)
- `{{COMMIT_SUBJECT}}`: Subject line from the message step
- `{{COMMIT_BODY}}`: Body from the message step

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" commit \
  --config .claude/settings.plugins.commit-with-costs.json \
  --costs "{{CURRENT_COST}}" \
  --since "{{COST_SINCE}}" \
  <<'EOF'
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
EOF
```

The trailer is written with `"method":"merge"` and carries the project `sessionId`, so the
next `/commit-with-costs` on this branch anchors incrementally against this merge commit.

## Parse JSON Output

→ `status` → STATUS

→ "success":
  - `data.commit_sha` → COMMIT_SHA

→ "no_merge_in_progress": MERGE_HEAD is gone; the merge was already committed or aborted.

→ "conflicts_unresolved": `data.unresolved` are still unmerged. Back to the conflict step.

→ "metrics_invalid", "git_error", or "error":
  - `message` → ERROR_MESSAGE
  - The merge remains staged. Tell the user it is still in progress.
