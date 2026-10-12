# Compute Merge Cost Metrics

## Execute Command

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" prepare-merge
```

When INCLUDED_SESSIONS is set, add `--include-sessions {{INCLUDED_SESSIONS joined by commas}}`
and `--branches {{BRANCHES joined by commas}}`.

**NOTE:** If the above command fails, execute this script and try again:
```bash
if [ ! -d "{{SKILL_BASE_DIR}}/../../node_modules/ccusage" ]; then
  echo "!!! Installing ccusage:"
  npm install --prefix "{{SKILL_BASE_DIR}}/../.."
else
  echo "✓ ccusage available"
fi
```

Cost covers the project root's session since its last cost-trailered commit, which already
includes sub-agent work inside worktrees. A Claude session launched *inside* a worktree counts
only when INCLUDED_SESSIONS names it (Step 2).

## Parse JSON Output

→ `status` → FETCH_STATUS

→ If FETCH_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array, by model)
  - `data.since` → COST_SINCE
  - `data.included_sessions` → INCLUDED_SESSION_DETAILS (array of {session_id, since})

→ If FETCH_STATUS = "no_anchor": same fields; `data.since` is null and the costs cover the whole
  session. Confirm with the user before using them.

→ If FETCH_STATUS = "invalid_session":
  - `message` → ERROR_MESSAGE
  - An included id is outside this repo's session prefix or has no session data.

→ If FETCH_STATUS = "invalid_costs" or "error":
  - `message` → ERROR_MESSAGE
