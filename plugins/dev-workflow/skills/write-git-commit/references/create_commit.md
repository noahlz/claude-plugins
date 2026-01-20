# Create Git Commit

**Contents:**
- Bash Command Instructions
- Command Result Handling
- Return to Main Workflow

**IMPORTANT:** NEVER use `git` commands directly for creating a commit - ALWAYS use the scripts referenced in the below instructions.

--- 

## Bash Command Instructions

**Value Replacements:**

- `{{SESSION_ID}}`: Literal session ID from Step 5
- `{{CURRENT_COST}}`: Literal JSON array from Step 5
- `{{COMMIT_SUBJECT}}`: Subject line from Step 4
- `{{COMMIT_BODY}}`: Body from Step 4 (omit blank line if empty)

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

## Return to Main Workflow with Stored Values

→ Return to SKILL.md with STATUS and related values stored mentally from the commit result.
