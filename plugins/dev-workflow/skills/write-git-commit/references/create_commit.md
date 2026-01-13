# Create Git Commit

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

**IMPORTANT:** The script will validate cost metrics before committing. Do NOT improvise git commit logic.

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

→ Extract value from JSON field `status` and store in STATUS variable.

→ If STATUS = "success":
  - → Extract value from JSON field `data.commit_sha` and store in COMMIT_SHA variable.

→ If STATUS = "metrics_invalid":
  - → Extract value from JSON field `message` and store in ERROR_MESSAGE variable.

→ If STATUS is not "success":
  - → Extract value from JSON field `message` and store in ERROR_MESSAGE variable.

Return to SKILL.md with STATUS and related values based on the commit result.
