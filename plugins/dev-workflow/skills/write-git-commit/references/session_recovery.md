**✗ If status is "error" and message contains "Session not found":**
  - Execute using Bash tool to get available sessions:
    ```bash
    # Replace __PLUGIN_ROOT__ with literal path from Section 0
    CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
    node "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.js" list-sessions
    ```
  - Parse JSON output to extract sessions array from data.sessions
  - Build AskUserQuestion with dynamic options:
    - For each session in first 4 from sessions array: Create option with label = sessionId
    - Add final option: "Other (cancel commit)"
  - If user picks a session:
    - Save to config using save-config command:
      ```bash
      # Replace __PLUGIN_ROOT__ and __SELECTED_SESSION_ID__ with literal values
      CLAUDE_PLUGIN_ROOT=__PLUGIN_ROOT__ \
      node "__PLUGIN_ROOT__/skills/write-git-commit/scripts/commit-workflow.js" save-config "$(pwd)" "__SELECTED_SESSION_ID__"
      ```
    - Retry Section 2 with new session ID
  - If user picks "Other":
    - Run `git reset HEAD` to unstage changes
    - Display: "Commit cancelled"
    - Exit workflow

**✗ If status is "error" (other errors):**
  - Display error message
  - Use AskUserQuestion:
    - "Stop and investigate" (Recommended)
    - "Commit without metrics"
  - If "Stop and investigate":
    - Run `git reset HEAD` to unstage changes
    - Display: "Changes unstaged. Please investigate."
    - Exit workflow
  - If "Commit without metrics":
    - Set CURRENT_COST to empty array: `[]`
    - Proceed to Section 3