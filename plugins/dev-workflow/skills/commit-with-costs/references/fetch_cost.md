# Fetch Cost Metrics

**Contents:**
- Check ccusage dependency
- Execute fetch command
- Parse JSON output
- Return to Main Workflow

---

## Execute Fetch Command

```bash
node "{{PLUGIN_ROOT}}/skills/commit-with-costs/scripts/commit-workflow.js" prepare --config
```

**NOTE:** If the above command fails, execute this script and try again:
```bash
if [ ! -d "{{PLUGIN_ROOT}}/node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  npm install --prefix "{{PLUGIN_ROOT}}"
else
  echo "✓ ccusage available"
fi
```

## Parse JSON Output

→ `status` → FETCH_STATUS

→ If FETCH_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array)
  - `data.method` → COST_METHOD
  - `data.since` → COST_SINCE (may be null)
  - `data.cleanup_period_days` → CLEANUP_PERIOD_DAYS

→ If FETCH_STATUS = "invalid_costs" or "not_found" or "error":
  - `message` → ERROR_MESSAGE
