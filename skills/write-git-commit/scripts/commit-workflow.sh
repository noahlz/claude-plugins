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

# Detect CLAUDE_PLUGIN_ROOT from script location if not set
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
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

# Action: prepare - Load config, get current session costs, and check if session filter confirmation needed
action_prepare() {
  # Source configuration
  export CLAUDE_PLUGIN_ROOT
  source "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/load-config.sh"

  # Check if session filter needs confirmation (first run scenario)
  if [ "$SESSION_FILTER_CONFIRMED" = "false" ]; then
    # Return status to ask user for confirmation
    local data=$(jq -n \
      --arg detected "$AUTO_DETECTED_FILTER" \
      '{detected_filter: $detected}')
    json_response "confirm_session" "$data" "Session filter needs confirmation"
    exit 0
  fi

  # Get current session costs
  CURRENT_COST=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/claude-session-cost.sh" 2>&1)
  if [ $? -ne 0 ]; then
    json_response_simple "error" "Failed to fetch current session costs"
    exit 1
  fi

  # Extract session ID (already set by load-config.sh)
  if [ -z "$SESSION_ID" ]; then
    json_response_simple "error" "Failed to extract session ID"
    exit 1
  fi

  # Return as JSON
  local data=$(jq -n \
    --arg session_id "$SESSION_ID" \
    --argjson current_cost "$CURRENT_COST" \
    '{session_id: $session_id, current_cost: $current_cost}')

  json_response "success" "$data" "Fetched current session costs"
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
