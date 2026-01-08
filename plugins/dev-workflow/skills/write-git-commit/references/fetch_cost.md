# Cost Data Fetch Instructions

## Action Required

Execute commit-workflow.js prepare command to fetch session cost metrics.

## Bash Command

```bash
# Use {{SKILL_BASE_DIR}} (extracted from skill startup) and {{SESSION_ID}}
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare "$(pwd)" "{{SESSION_ID}}"
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
