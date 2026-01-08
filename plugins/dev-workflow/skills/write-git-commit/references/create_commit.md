# Commit Creation Instructions

## Important

Do NOT improvise git commit logic - commit-workflow.js handles all commit creation. ONLY use that script.

## Bash Command

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

## Value Replacements

- `{{SESSION_ID}}`: Literal session ID from Step 4
- `{{CURRENT_COST}}`: Literal JSON array from Step 4
- `{{COMMIT_SUBJECT}}`: Subject line from Step 3
- `{{COMMIT_BODY}}`: Body from Step 3 (omit blank line if empty)

## Format Rules

- If body is empty: Only subject (no blank line)
- If body exists: Subject, blank line, then body

## Validation

Before executing:
- Check `CURRENT_COST` is array with at least one entry
- Check at least one model has cost > 0
- If invalid: Return to Step 4 to re-fetch metrics

## Parse Output

Extract `COMMIT_SHA` from JSON data.commit_sha field

## Response Handling

- ✓ If status is "success": Continue to Step 6 with commit SHA
- ✗ If status is NOT "success": Follow procedures in `references/commit_recovery.md`

## Important Notes

- This command should NOT trigger permission prompts (user approved in Step 3)
- Session ID and costs are CLI arguments
- Commit message passed via stdin (heredoc)
- Keep `$CURRENT_COST` as quoted JSON string

## Next Step

If successful: Return to SKILL.md Step 6 with COMMIT_SHA for summary display.
