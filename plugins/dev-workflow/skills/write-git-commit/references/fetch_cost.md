→ Execute using Bash tool:
```bash
# Replace __PLUGIN_ROOT__ and __SESSION_ID__ with literal values from Section 0
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "__PLUGIN_ROOT__/skills/write-git-commit/scripts/commit-workflow.js" prepare "$(pwd)" "__SESSION_ID__"
```

→ Parse JSON output to extract cost data:
- **status**: Result status ("success" or "error")
- **data.session_id**: Resolved session ID (may differ from input if auto-detected)
- **data.current_cost**: JSON array of cost objects
- **data.method**: Detection method ("library" or "cli")
- **message**: Error message (if status is "error")

→ Handle result based on status:

**✓ If status is "success":**
  - `SESSION_ID` and `CURRENT_COST` are captured from JSON data fields
  - Store these as literal values for use in Section 3
  - Proceed to Section 3 (Create Commit) with captured literals

**✗ If status is NOT "success":**

Follow the procedures defined in `references/session_recovery.md`