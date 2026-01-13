---
**Contents:**
- Bash Command
- Command Result Handling
---

## Bash Command

**IMPORTANT:** Do NOT improvise git commit logic - the script `scripts/commit-workflow.js` handles all git commit operations.

**Value Replacements:**

- `{{SESSION_ID}}`: Literal session ID from Step 5
- `{{CURRENT_COST}}`: Literal JSON array from Step 5
- `{{COMMIT_SUBJECT}}`: Subject line from Step 4
- `{{COMMIT_BODY}}`: Body from Step 4 (omit blank line if empty)

**Value Validation:**

Before executing:
- Check `CURRENT_COST` is array with at least one entry
- Check at least one model has cost > 0
- If invalid: DO NOT execute below command. Return to Step 5 to re-fetch metrics

**Command:**

```bash
# Use {{SKILL_BASE_DIR}} (extracted from skill startup) and captured values
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" commit \
  --session-id "{{SESSION_ID}}" \
  --costs "{{CURRENT_COST}}" \
  <<'EOF'
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
EOF
```

## Command Result Handling

Extract from command JSON output:
- `status` from `data.status` field
- `COMMIT_SHA` from `data.commit_sha` field

✓ If `status` is "success": Continue to Step 7 with `COMMIT_SHA` value  
✗ If `status` is NOT "success" → Display error from JSON `data.message` field and Exit Workflow immediately.  
