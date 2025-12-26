#!/bin/bash
# Load write-git-commit configuration
# Auto-detects session ID from project directory if not configured
# Usage: source ./scripts/load-config.sh

set -e

# Function to convert pwd to session ID format
# /Users/noahlz/projects/claude-plugins → -Users-noahlz-projects-claude-plugins
pwd_to_session_id() {
  local path="$1"
  echo "$path" | sed 's|/|-|g'
}

# Load configuration from .claude directory
CONFIG_FILE=".claude/settings.plugins.write-git-commit.json"

if [ -f "$CONFIG_FILE" ]; then
  SESSION_ID=$(jq -r '.sessionId // empty' "$CONFIG_FILE" 2>/dev/null)
  export CONFIG_EXISTS="true"
  export SESSION_AUTO_DETECTED="false"
else
  # No config - auto-detect from pwd
  SESSION_ID=$(pwd_to_session_id "$(pwd)")
  export CONFIG_EXISTS="false"
  export SESSION_AUTO_DETECTED="true"
fi

# Validate we have a session ID
if [ -z "$SESSION_ID" ]; then
  echo "Error: Could not determine session ID" >&2
  exit 1
fi

export SESSION_ID
