# Commit Creation Instructions

## Important

Do NOT improvise git commit logic - commit-workflow.js handles all commit creation. ONLY use that script.

## Bash Command

```bash
# Replace __PLUGIN_ROOT__, __SESSION_ID__, __CURRENT_COST__, __COMMIT_SUBJECT__, and __COMMIT_BODY__
# with captured/approved literal values from previous steps
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "__PLUGIN_ROOT__/skills/write-git-commit/scripts/commit-workflow.js" commit \
  --session-id "__SESSION_ID__" \
  --costs "__CURRENT_COST__" \
  <<'EOF'
__COMMIT_SUBJECT__

__COMMIT_BODY__
EOF
```

## Value Replacements

- `__SESSION_ID__`: Literal session ID from Step 4
- `__CURRENT_COST__`: Literal JSON array from Step 4
- `__COMMIT_SUBJECT__`: Subject line from Step 3
- `__COMMIT_BODY__`: Body from Step 3 (omit blank line if empty)

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
- Session ID and costs are CLI arguments, not env vars
- Commit message passed via stdin (heredoc)
- Keep `__CURRENT_COST__` as quoted JSON string

## Next Step

If successful: Return to SKILL.md Step 6 with COMMIT_SHA for summary display.
