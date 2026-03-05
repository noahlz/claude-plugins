# Create Git Commit

**Contents:**
- Bash Command Instructions
- Command Result Handling
- Return to Main Workflow

**IMPORTANT:** NEVER use `git` commands directly for creating a commit - ALWAYS use the scripts referenced in the below instructions.

---

## Execute Command

**Value Replacements:**
- `{{SESSION_ID}}`: Literal session ID from Step 5
- `{{CURRENT_COST}}`: Literal JSON array from Step 5
- `{{COMMIT_SUBJECT}}`: Subject line from Step 4
- `{{COMMIT_BODY}}`: Body from Step 4 (omit blank line if empty)

```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" commit \
  --session-id "{{SESSION_ID}}" \
  --costs "{{CURRENT_COST}}" \
  <<'EOF'
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
EOF
```

## Parse JSON Output

→ `status` → STATUS

→ If STATUS = "success":
  - `data.commit_sha` → COMMIT_SHA

→ If STATUS = "metrics_invalid" or other error:
  - `message` → ERROR_MESSAGE
