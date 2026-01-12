# Cost Data Fetch Instructions

## Action Required

Execute `scripts/commit-workflow.js` "prepare" command to fetch session cost metrics.

## REQUIRED: Check that ccusage dependency installed

Check if `ccusage` is installed in the plugin directory:

```bash
# Use {{SKILL_BASE_DIR}} (extracted from skill startup)
if [ ! -d "{{SKILL_BASE_DIR}}/../../node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  cd  "{{SKILL_BASE_DIR}}/../.."
  npm install
fi
```

## Bash Command

```bash
# Use {{SKILL_BASE_DIR}} and {{SESSION_ID}} (extracted from skill startup)
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare "$(pwd)" "{{SESSION_ID}}"
```

## Parse JSON Output

Extract these fields:
- `status`: Result status ("success" or "error")
- `data.session_id`: Resolved session ID (may differ from input if auto-detected)
- `data.current_cost`: JSON array of cost objects
- `data.method`: Detection method ("library" or "cli")
- `message`: Error message (if status is "error")

## Response Handling

### ✓ If status is "success"

- Store `SESSION_ID` from data.session_id
- Store `CURRENT_COST` from data.current_cost (as JSON array string)
- Proceed to Step 6 (Create Commit) with these values

### ✗ If status is NOT "success"

- Display the error to the user 
- Tell the user "*** Session ID must be configured to accurately extract Claude Code cost metrics."
- Exit the workflow

## Important Notes

- Do NOT proceed with missing cost data
- Do NOT fabricate or estimate cost metrics
- If errors persist, stop workflow and ask user for guidance

## Next Step

If successful: Return to Step 6 with SESSION_ID and CURRENT_COST captured.
