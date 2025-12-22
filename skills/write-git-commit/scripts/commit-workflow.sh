#!/bin/bash
# Master orchestrator script for write-git-commit workflow
# Handles all bash logic and outputs JSON for the skill to consume
#
# Usage: commit-workflow.sh <action>
#
# Actions:
#   check-config      - Check if config file exists and is valid
#   prepare           - Load config, verify session, get session costs
#   commit            - Read commit message from stdin, build with footer, and create commit
#                       Reads: First line = subject, remaining lines = body (optional)
#                       Auto-fetches: SESSION_ID, CURRENT_COST (if not in env)
#   create-commit     - Execute git commit with provided message and return SHA
#
# Environment variables:
#   CLAUDE_PLUGIN_ROOT - Optional, auto-detected from script location if not set
#   SESSION_ID         - Optional for commit action (auto-loaded from config if not set)
#   CURRENT_COST       - Optional for commit action (auto-fetched if not set)

set -e

# Auto-detect CLAUDE_PLUGIN_ROOT from script location if not set
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi
export CLAUDE_PLUGIN_ROOT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ACTION="${1:-}"

# Helper: Verify session and return status
# Input: $1 = SESSION_ID to verify
# Sets global VERIFY_RESULT with JSON response
# Exits on error
verify_session() {
  local session_id="$1"

  VERIFY_RESULT=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/verify-session.sh" "$session_id")
  VERIFY_STATUS=$(echo "$VERIFY_RESULT" | jq -r '.status')

  case "$VERIFY_STATUS" in
    verified)
      # Session verified successfully
      return 0
      ;;
    not_found)
      json_response_simple "error" "Session ID not found: $session_id. Check ccusage session --json for available sessions."
      exit 1
      ;;
    error)
      ERROR_MSG=$(echo "$VERIFY_RESULT" | jq -r '.message')
      json_response_simple "error" "$ERROR_MSG"
      exit 1
      ;;
  esac
}

# Helper: Fetch session costs
# Requires SESSION_ID to be exported
# Sets global CURRENT_COST variable on success
# Exits on error
fetch_costs() {
  CURRENT_COST=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/claude-session-cost.sh" 2>&1)
  if [ $? -ne 0 ]; then
    json_response_simple "error" "Failed to fetch session costs: $CURRENT_COST"
    exit 1
  fi
}

# Action: check-config - Verify config file exists and is valid
action_check_config() {
  CONFIG_FILE=".claude/settings.plugins.write-git-commit.json"

  # Check if config file exists
  if [ ! -f "$CONFIG_FILE" ]; then
    json_response_simple "not_found" "Configuration file not found: $CONFIG_FILE"
    exit 0
  fi

  # Check if file is empty
  if [ ! -s "$CONFIG_FILE" ]; then
    json_response_simple "empty" "Configuration file is empty: $CONFIG_FILE"
    exit 0
  fi

  # Try to parse as JSON
  if ! CONFIG_DATA=$(jq '.' "$CONFIG_FILE" 2>/dev/null); then
    json_response_simple "invalid" "Configuration file is not valid JSON: $CONFIG_FILE"
    exit 0
  fi

  # Config exists and is valid
  local data=$(jq -n --argjson config "$CONFIG_DATA" '{config: $config}')
  json_response "found" "$data" "Configuration file exists and is valid"
}

# Action: prepare - Load config, verify session, get current session costs
action_prepare() {
  # Source configuration (sets SESSION_ID, CONFIG_EXISTS, SESSION_AUTO_DETECTED)
  source "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/load-config.sh"

  # Verify session exists
  verify_session "$SESSION_ID"
  VERIFIED_ID=$(echo "$VERIFY_RESULT" | jq -r '.data.session_id')

  # If config doesn't exist OR session was auto-detected, prompt to save
  if [ "$CONFIG_EXISTS" = "false" ] || [ "$SESSION_AUTO_DETECTED" = "true" ]; then
    local data=$(jq -n --arg detected "$VERIFIED_ID" '{detected_id: $detected}')
    json_response "confirm_session" "$data" "Session detected, confirm to save"
    exit 0
  fi

  # Get current session costs
  export SESSION_ID
  fetch_costs

  # Return verified session and costs
  local data=$(jq -n \
    --arg session_id "$SESSION_ID" \
    --argjson current_cost "$CURRENT_COST" \
    '{session_id: $session_id, current_cost: $current_cost}')

  json_response "success" "$data" "Session verified and costs fetched"
}

# Action: commit - Build message with footer and create commit
# Reads commit message from stdin:
#   First line = subject (required)
#   Remaining lines = body (optional)
# Auto-fetches SESSION_ID and CURRENT_COST if not provided via env vars
action_commit() {
  # Read commit message from stdin
  # First line is subject, rest is body
  local subject=""
  local body=""

  # Read first line (subject) - use || true to prevent set -e from terminating on EOF
  IFS= read -r subject || true
  if [ -z "$subject" ]; then
    json_response_simple "error" "Missing commit subject (first line of stdin)"
    exit 1
  fi

  # Read remaining lines as body - use || true to prevent set -e from terminating on EOF
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "$line" ]; then
      if [ -n "$body" ]; then
        body="${body}
${line}"
      else
        body="$line"
      fi
    else
      break
    fi
  done

  # Auto-load SESSION_ID if not provided via env var
  if [ -z "${SESSION_ID:-}" ]; then
    source "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/load-config.sh"
  fi
  local session_id="$SESSION_ID"

  # Auto-fetch CURRENT_COST if not provided via env var
  if [ -z "${CURRENT_COST:-}" ]; then
    # Verify session and fetch costs
    verify_session "$session_id"
    export SESSION_ID="$session_id"
    fetch_costs
  fi
  local current_cost="$CURRENT_COST"

  # Build JSON cost footer
  COST_FOOTER=$(jq -n \
    --arg sessionId "$session_id" \
    --argjson cost "$current_cost" \
    '{sessionId: $sessionId, cost: $cost}' | jq -c '.')

  # Build full commit message with git trailer format
  if [ -z "$body" ]; then
    FULL_MESSAGE="$subject

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: $COST_FOOTER"
  else
    FULL_MESSAGE="$subject

$body

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: $COST_FOOTER"
  fi

  # Execute git commit
  if ! git commit -m "$FULL_MESSAGE" > /dev/null 2>&1; then
    json_response_simple "error" "Failed to create git commit"
    exit 1
  fi

  # Get commit SHA
  COMMIT_SHA=$(git rev-parse HEAD)
  if [ -z "$COMMIT_SHA" ]; then
    json_response_simple "error" "Failed to retrieve commit SHA"
    exit 1
  fi

  local data=$(jq -n --arg sha "$COMMIT_SHA" '{commit_sha: $sha}')
  json_response "success" "$data" "Commit created successfully"
}

# Action: create-commit - Execute git commit and return SHA
action_create_commit() {
  local message="${1:-}"

  if [ -z "$message" ]; then
    json_response_simple "error" "Missing commit message"
    exit 1
  fi

  # Execute git commit
  if ! git commit -m "$message" > /dev/null 2>&1; then
    json_response_simple "error" "Failed to create git commit"
    exit 1
  fi

  # Get commit SHA
  COMMIT_SHA=$(git rev-parse HEAD)
  if [ -z "$COMMIT_SHA" ]; then
    json_response_simple "error" "Failed to retrieve commit SHA"
    exit 1
  fi

  local data=$(jq -n --arg sha "$COMMIT_SHA" '{commit_sha: $sha}')
  json_response "success" "$data" "Commit created successfully"
}


# Main dispatcher
case "$ACTION" in
  check-config)
    action_check_config
    ;;
  prepare)
    action_prepare
    ;;
  commit)
    action_commit
    ;;
  create-commit)
    action_create_commit "$2"
    ;;
  *)
    json_response_simple "error" "Unknown action: $ACTION"
    exit 1
    ;;
esac
