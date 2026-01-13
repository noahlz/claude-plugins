# Fetch Cost Metrics

**Contents:**
---
- Check ccusage dependency
- Execute fetch command
- Parse JSON output
- Handle response

## Check ccusage Dependency

→ Check if `ccusage` is installed in the plugin directory:

```bash
# Use {{SKILL_BASE_DIR}} (extracted from skill startup)
if [ ! -d "{{SKILL_BASE_DIR}}/../../node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  cd  "{{SKILL_BASE_DIR}}/../.."
  npm install
fi
```

## Execute Fetch Command

→ Run the following command to fetch session cost metrics:

```bash
# Use {{SKILL_BASE_DIR}} and {{SESSION_ID}} (extracted from skill startup)
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare "$(pwd)" "{{SESSION_ID}}"
```

## Parse JSON Output

→ Extract value from JSON field `status` and store in FETCH_STATUS variable.
→ Extract value from JSON field `data.session_id` and store in SESSION_ID variable.
→ Extract JSON array from field `data.current_cost` and store in CURRENT_COST variable.
→ If `status` is not "success": Extract value from JSON field `message` and store in ERROR_MESSAGE variable.

## Validate Parsed Values

→ Check that FETCH_STATUS is exactly "success" (string match).
→ If FETCH_STATUS = "success": Check that CURRENT_COST is a non-empty array with at least one object.
→ If FETCH_STATUS = "success": Check that at least one cost object has cost > 0.
→ If any validation fails: Set FETCH_STATUS to "error" and store validation failure message in ERROR_MESSAGE.

## Handle Response

→ If FETCH_STATUS = "success": Store SESSION_ID and CURRENT_COST values for Step 6.
→ If FETCH_STATUS is not "success": Store ERROR_MESSAGE for display to user.

**IMPORTANT:** Do NOT proceed with missing cost data. Do NOT fabricate or estimate cost metrics. Return status to SKILL.md for error handling.

Execution complete. Values available: FETCH_STATUS, SESSION_ID, CURRENT_COST (if success) or ERROR_MESSAGE (if failed)
