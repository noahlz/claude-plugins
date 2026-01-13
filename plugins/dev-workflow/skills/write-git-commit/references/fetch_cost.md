# Fetch Cost Metrics

**Contents:**
- Check ccusage dependency
- Execute fetch command
- Parse JSON output
- Handle response

---

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

→ If FETCH_STATUS = "success":
  - → Extract value from JSON field `data.session_id` and store in SESSION_ID variable.
  - → Extract JSON array from field `data.current_cost` and store in CURRENT_COST variable.
  - → Store SESSION_ID and CURRENT_COST values for Step 6.

→ If FETCH_STATUS = "invalid_costs":
  - → Extract value from JSON field `message` and store in ERROR_MESSAGE variable.

→ If FETCH_STATUS = "not_found" or "error":
  - → Extract value from JSON field `message` and store in ERROR_MESSAGE variable.

**IMPORTANT:** Do NOT proceed with missing cost data. Do NOT fabricate or estimate cost metrics. Resume skill workflow with status for error handling.

Execution complete. Values available: FETCH_STATUS, SESSION_ID, CURRENT_COST (if success) or ERROR_MESSAGE (if failed)
