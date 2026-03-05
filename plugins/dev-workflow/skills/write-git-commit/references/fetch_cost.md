# Fetch Cost Metrics

**Contents:**
- Check ccusage dependency
- Execute fetch command
- Parse JSON output
- Return to Main Workflow

---

## Execute Fetch Command

```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" prepare "$(pwd)" "{{SESSION_ID}}"
```

**NOTE:** If the above command fails, execute this script and try again:
```bash
if [ ! -d "{{SKILL_BASE_DIR}}/../../node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  npm install --prefix "{{SKILL_BASE_DIR}}/../.."
else
  echo "✓ ccusage available"
fi
```

## Parse JSON Output

→ `status` → FETCH_STATUS

→ If FETCH_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array)

→ If FETCH_STATUS = "invalid_costs" or "not_found" or "error":
  - `message` → ERROR_MESSAGE
