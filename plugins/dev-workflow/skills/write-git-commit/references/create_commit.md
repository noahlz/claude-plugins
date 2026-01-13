---
**Contents:**
---
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

**Validate Before Executing:**

→ Check that `CURRENT_COST` is an array with at least one entry.
→ Check that at least one model has cost > 0.
→ **IMPORTANT:** If validation fails: Do NOT execute bash command under any circumstances. Display error message: "Cost metrics validation failed. Cannot proceed with commit." HALT - return to SKILL.md which will exit workflow.

**Execute Command:**

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

→ Extract value from JSON field `data.status` and store in STATUS variable.
→ Extract value from JSON field `data.commit_sha` and store in COMMIT_SHA variable.
→ If `status` is not "success": Extract value from JSON field `data.message` and store in ERROR_MESSAGE variable.

Execution complete. Values available: STATUS, COMMIT_SHA (if success) or ERROR_MESSAGE (if failed)
