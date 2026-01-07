 **IMPORTANT:** Do NOT improvise git commit creation logic - `commit-workflow.js` handles all commit creation logic. ONLY use that script for creating git commits (per these instrucitons). 

→ Execute using Bash tool:
```bash
# Replace __PLUGIN_ROOT__, __SESSION_ID__, __CURRENT_COST__, __COMMIT_SUBJECT__, and __COMMIT_BODY__
# with captured/approved literal values from previous sections
CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
node "__PLUGIN_ROOT__/skills/write-git-commit/scripts/commit-workflow.js" commit \
  --session-id "__SESSION_ID__" \
  --costs "__CURRENT_COST__" \
  <<'EOF'
__COMMIT_SUBJECT__

__COMMIT_BODY__
EOF
```

**Value replacements required:**
- `__SESSION_ID__`: Literal SESSION_ID captured from Section 2 JSON output
- `__CURRENT_COST__`: Literal CURRENT_COST captured from Section 2 JSON output (JSON array string)
- `__COMMIT_SUBJECT__`: Subject line approved by user in Section 1e
- `__COMMIT_BODY__`: Body lines approved by user in Section 1e (omit entire section if body is empty)

**Format rules:**
  - If body is empty: Only subject (no blank line)
  - If body exists: Subject, blank line, then body

⚠ IMPORTANT:
  - This bash command should NOT trigger permission prompts - user already approved message in section 1e and session in section 2
  - Session ID and costs are passed as CLI arguments (not env vars)
  - Commit message is passed via stdin (heredoc)
  - Ensure `__CURRENT_COST__` remains a quoted JSON string

→ Validate cost metrics before sending commit:
  - Check `COMMIT_COST` is array with at least one entry
  - Check at least one model has cost > 0
  - If invalid: Return to section 2 to re-fetch metrics

→ Parse JSON output to extract `COMMIT_SHA` from `data.commit_sha`

✓ If status is "success" → Continue to section 4  
✗ If status is not "success" → Follow the procedures defined in `references/commit_recovery.md`