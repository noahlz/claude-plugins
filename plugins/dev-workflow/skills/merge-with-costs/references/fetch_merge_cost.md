# Compute Merge Cost Metrics

## Execute Command

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" prepare-merge \
  --config .claude/settings.plugins.commit-with-costs.json
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

Cost comes from one session: the project root's, counted since its own last cost-trailered
commit. A sub-agent's work inside a worktree is written to the transcripts of the session that
dispatched it, so it is already included. A Claude session launched *inside* a worktree is not;
Step 0 and Step 2 raise that case before anything is merged.

## Parse JSON Output

→ `status` → FETCH_STATUS

→ If FETCH_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array, by model)
  - `data.since` → COST_SINCE

→ If FETCH_STATUS = "no_anchor": same fields; `data.since` is null and the costs cover the whole
  session. Confirm with the user before using them.

→ If FETCH_STATUS = "invalid_costs" or "error":
  - `message` → ERROR_MESSAGE
