#!/bin/bash
# Load write-git-commit configuration
# Supports auto-detection of session filter based on project directory
# Usage: source ./scripts/load-config.sh

# Detect CLAUDE_PLUGIN_ROOT from script location if not set
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  export CLAUDE_PLUGIN_ROOT
fi

# Load project config file if it exists
CONFIG_FILE="settings.plugins.write-git-commit.json"
if [ -f "$CONFIG_FILE" ]; then
  SESSION_FILTER=$(cat "$CONFIG_FILE" | jq -r '.sessionFilter // empty' 2>/dev/null)
else
  SESSION_FILTER=""
fi

# If session filter not configured, auto-detect from project directory
if [ -z "$SESSION_FILTER" ]; then
  PROJECT_NAME=$(basename "$(pwd)")
  export AUTO_DETECTED_FILTER="$PROJECT_NAME"
  export SESSION_FILTER_CONFIRMED="false"
else
  export SESSION_FILTER="$SESSION_FILTER"
  export SESSION_FILTER_CONFIRMED="true"
fi

# Verify session exists (called by claude-session-cost.sh later)
# Export SESSION_FILTER for use by other scripts
export SESSION_FILTER="${SESSION_FILTER:-$PROJECT_NAME}"
