# Fetch Cost Metrics

**Contents:**
- Check ccusage dependency
- Execute fetch command
- Parse JSON output
- Return to Main Workflow

---

## Execute Fetch Command

→ Run the following command to fetch session cost metrics:

```bash
# Use {{SKILL_BASE_DIR}} and {{SESSION_ID}} values (extracted from skill startup)
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare "$(pwd)" "{{SESSION_ID}}"
```

**NOTE:** If the above command fails, execute this script and try again: 
```bash
# Use {{SKILL_BASE_DIR}} value (extracted from skill startup)
if [ ! -d "{{SKILL_BASE_DIR}}/../../node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  npm install --prefix "{{SKILL_BASE_DIR}}/../.."
else
  echo "✓ ccusage available"
fi
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

## Return to Main Workflow with Stored Values

→ Return to SKILL.md with FETCH_STATUS, CURRENT_COST and related values from the fetch result stored mentally.
