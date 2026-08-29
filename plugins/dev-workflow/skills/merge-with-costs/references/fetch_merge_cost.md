# Pool Merge Cost Metrics

## Execute Command

**Value Replacements:**
- `{{BRANCHES}}`: Merged branch names, comma-separated, no spaces

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" prepare-merge \
  --config .claude/settings.plugins.commit-with-costs.json \
  --branches "{{BRANCHES}}"
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

Each merged branch contributes its whole worktree session, because worktree branch commits carry no
cost trailer to anchor against. The orchestrator contributes only what it spent since its own last
cost-trailered commit, so work already attributed on this branch is not counted twice.

## Parse JSON Output

→ `status` → FETCH_STATUS

→ If FETCH_STATUS = "success":
  - `data.session_id` → SESSION_ID (orchestrator)
  - `data.current_cost` → CURRENT_COST (JSON array, pooled by model)
  - `data.since` → COST_SINCE (orchestrator anchor, may be null)
  - `data.contributions` → CONTRIBUTIONS (per-session breakdown, display only)
  - `data.unresolved` → UNRESOLVED (branches whose cost data is gone)

→ If FETCH_STATUS = "invalid_costs", "not_found", or "error":
  - `message` → ERROR_MESSAGE
