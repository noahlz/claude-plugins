#!/bin/bash
# Master orchestrator script for write-git-commit workflow
# Handles all bash logic and outputs JSON for the skill to consume
#
# Usage: commit-workflow.sh <action> [options]
#
# Actions:
#   prepare           - Load config, calculate costs, get session info
#   build-message     - Build commit message with footer
#   create-commit     - Execute git commit and return SHA
#   append-metrics    - Append metrics entry to file
#   check-gitignore   - Check if metrics file is in .gitignore
#   add-gitignore     - Add metrics file to .gitignore

set -e

# CLAUDE_PLUGIN_ROOT must be set by caller
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  jq -n '{status: "error", message: "CLAUDE_PLUGIN_ROOT not set"}' >&2
  exit 1
fi
export CLAUDE_PLUGIN_ROOT
ACTION="${1:-}"

# Output JSON response
json_response() {
  local status="$1"
  local data="$2"
  local message="$3"

  jq -n \
    --arg status "$status" \
    --argjson data "$data" \
    --arg message "$message" \
    '{status: $status, data: $data, message: $message}'
}

json_response_simple() {
  local status="$1"
  local message="$2"

  jq -n \
    --arg status "$status" \
    --arg message "$message" \
    '{status: $status, data: {}, message: $message}'
}

# Action: prepare - Load config, verify session, get current session costs
action_prepare() {
  # Source configuration (sets SESSION_ID, CONFIG_EXISTS, SESSION_AUTO_DETECTED)
  source "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/load-config.sh"

  # Verify session exists
  VERIFY_RESULT=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/verify-session.sh" "$SESSION_ID")
  VERIFY_STATUS=$(echo "$VERIFY_RESULT" | jq -r '.status')

  case "$VERIFY_STATUS" in
    verified)
      VERIFIED_ID=$(echo "$VERIFY_RESULT" | jq -r '.data.session_id')

      # If config doesn't exist OR session was auto-detected, prompt to save
      if [ "$CONFIG_EXISTS" = "false" ] || [ "$SESSION_AUTO_DETECTED" = "true" ]; then
        local data=$(jq -n --arg detected "$VERIFIED_ID" '{detected_id: $detected}')
        json_response "confirm_session" "$data" "Session detected, confirm to save"
        exit 0
      fi

      # Config exists and verified - proceed
      ;;

    not_found)
      json_response_simple "error" "Session ID not found: $SESSION_ID. Check ccusage session --json for available sessions."
      exit 1
      ;;

    error)
      ERROR_MSG=$(echo "$VERIFY_RESULT" | jq -r '.message')
      json_response_simple "error" "$ERROR_MSG"
      exit 1
      ;;
  esac

  # Get current session costs
  export SESSION_ID
  CURRENT_COST=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/claude-session-cost.sh" 2>&1)
  if [ $? -ne 0 ]; then
    json_response_simple "error" "Failed to fetch session costs: $CURRENT_COST"
    exit 1
  fi

  # Return verified session and costs
  local data=$(jq -n \
    --arg session_id "$SESSION_ID" \
    --argjson current_cost "$CURRENT_COST" \
    '{session_id: $session_id, current_cost: $current_cost}')

  json_response "success" "$data" "Session verified and costs fetched"
}

# Action: build-message - Build commit message with footer
action_build_message() {
  local subject="${1:-}"
  local body="${2:-}"
  local session_id="${3:-}"
  local current_cost="${4:-}"

  if [ -z "$subject" ] || [ -z "$session_id" ] || [ -z "$current_cost" ]; then
    json_response_simple "error" "Missing required parameters for build-message"
    exit 1
  fi

  # Build JSON cost footer (no date field - git commit has timestamp)
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

  # Escape for JSON output
  local message_json=$(jq -R -s '.' <<< "$FULL_MESSAGE")

  local data=$(jq -n --argjson message "$message_json" '{full_message: $message}')
  json_response "success" "$data" "Built commit message with cost metrics footer"
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
  prepare)
    action_prepare
    ;;
  build-message)
    action_build_message "$2" "$3" "$4" "$5"
    ;;
  create-commit)
    action_create_commit "$2"
    ;;
  *)
    json_response_simple "error" "Unknown action: $ACTION"
    exit 1
    ;;
esac
