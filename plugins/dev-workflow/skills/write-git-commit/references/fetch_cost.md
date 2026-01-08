# Cost Data Fetch Instructions

## Action Required

Execute commit-workflow.js prepare command to fetch session cost metrics.

## Bash Command

```bash
# Replace __PLUGIN_ROOT__ and __SESSION_ID__ with literal values from Step 0
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "__PLUGIN_ROOT__/skills/write-git-commit/scripts/commit-workflow.js" prepare "$(pwd)" "__SESSION_ID__"
```

## Parse JSON Output

Extract these fields:
- **status**: Result status ("success" or "error")
- **data.session_id**: Resolved session ID (may differ from input if auto-detected)
- **data.current_cost**: JSON array of cost objects
- **data.method**: Detection method ("library" or "cli")
- **message**: Error message (if status is "error")

## Response Handling

### ✓ If status is "success"

- Store `SESSION_ID` from data.session_id
- Store `CURRENT_COST` from data.current_cost (as JSON array string)
- Proceed to Step 5 (Create Commit) with these values

### ✗ If status is NOT "success"

Follow recovery procedures in `references/session_recovery.md`

## Important Notes

- Do NOT proceed with missing cost data
- Do NOT fabricate or estimate cost metrics
- If errors persist, stop workflow and ask user for guidance

## Next Step

If successful: Return to SKILL.md Step 5 with SESSION_ID and CURRENT_COST captured.
