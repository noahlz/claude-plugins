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

CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-.}"
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

# Action: prepare - Load config, calculate costs, get session info
action_prepare() {
  # Source configuration
  export CLAUDE_PLUGIN_ROOT
  source "${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh"

  # Validate that config was loaded
  if [ -z "$METRICS_FILE" ]; then
    json_response_simple "error" "Failed to load METRICS_FILE from configuration"
    exit 1
  fi

  # Calculate cost delta (capture both stdout and stderr)
  COST_DELTA_OUTPUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/claude-cost-delta.sh" "$METRICS_FILE" 2>&1)
  COST_DELTA_EXIT=$?

  if [ $COST_DELTA_EXIT -eq 2 ]; then
    # Negative delta detected - extract actual delta from output (last JSON line)
    # and return warning status with has_negative flag
    COST_DELTA=$(echo "$COST_DELTA_OUTPUT" | tail -1)

    ISO_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local data=$(jq -n \
      --arg session_id "unknown" \
      --argjson cost_delta "$COST_DELTA" \
      --arg iso_date "$ISO_DATE" \
      --arg metrics_file "$METRICS_FILE" \
      --arg has_negative "true" \
      '{session_id: $session_id, cost_delta: $cost_delta, iso_date: $iso_date, metrics_file: $metrics_file, has_negative: $has_negative}')

    json_response "warning" "$data" "Negative cost delta detected - user choice required"
    exit 0

  elif [ $COST_DELTA_EXIT -ne 0 ]; then
    json_response_simple "error" "Failed to calculate cost delta"
    exit 1
  fi

  # Normal case - positive delta
  COST_DELTA="$COST_DELTA_OUTPUT"

  # Extract session ID (respects SESSION_FILTER)
  if [ "$SESSION_FILTER" = "null" ] || [ -z "$SESSION_FILTER" ]; then
    SESSION_ID=$(ccusage session --json 2>/dev/null | jq -r '.sessions[0].sessionId' 2>/dev/null)
  else
    SESSION_ID=$(ccusage session --json 2>/dev/null | jq -r ".sessions[] | select(.sessionId | contains(\"$SESSION_FILTER\")) | .sessionId" 2>/dev/null | head -1)
  fi

  if [ -z "$SESSION_ID" ]; then
    json_response_simple "error" "Failed to extract session ID"
    exit 1
  fi

  # Get current timestamp in ISO 8601 format
  ISO_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Return as JSON
  local data=$(jq -n \
    --arg session_id "$SESSION_ID" \
    --argjson cost_delta "$COST_DELTA" \
    --arg iso_date "$ISO_DATE" \
    --arg metrics_file "$METRICS_FILE" \
    '{session_id: $session_id, cost_delta: $cost_delta, iso_date: $iso_date, metrics_file: $metrics_file}')

  json_response "success" "$data" "Prepared cost data and session info"
}

# Action: build-message - Build commit message with footer
action_build_message() {
  local subject="${1:-}"
  local body="${2:-}"
  local session_id="${3:-}"
  local cost_delta="${4:-}"
  local iso_date="${5:-}"

  if [ -z "$subject" ] || [ -z "$session_id" ] || [ -z "$cost_delta" ] || [ -z "$iso_date" ]; then
    json_response_simple "error" "Missing required parameters for build-message"
    exit 1
  fi

  # Build JSON cost footer
  COST_FOOTER=$(jq -n \
    --arg sessionId "$session_id" \
    --argjson cost "$cost_delta" \
    --arg date "$iso_date" \
    '{sessionId: $sessionId, cost: $cost, date: $date}' | jq -c '.')

  # Build full commit message
  if [ -z "$body" ]; then
    FULL_MESSAGE="$subject

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
$COST_FOOTER"
  else
    FULL_MESSAGE="$subject

$body

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
$COST_FOOTER"
  fi

  # Escape for JSON output
  local message_json=$(jq -R -s '.' <<< "$FULL_MESSAGE")

  local data=$(jq -n --argjson message "$message_json" '{full_message: $message}')
  json_response "success" "$data" "Built commit message with cost footer"
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

# Action: append-metrics - Append metrics entry to file
action_append_metrics() {
  local commit_sha="${1:-}"
  local subject="${2:-}"
  local cost_delta="${3:-}"

  if [ -z "$commit_sha" ] || [ -z "$subject" ] || [ -z "$cost_delta" ]; then
    json_response_simple "error" "Missing required parameters for append-metrics"
    exit 1
  fi

  # Source config to get METRICS_FILE and SESSION_FILTER
  export CLAUDE_PLUGIN_ROOT
  source "${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh"

  # Extract session ID (respects SESSION_FILTER)
  if [ "$SESSION_FILTER" = "null" ] || [ -z "$SESSION_FILTER" ]; then
    SESSION_ID=$(ccusage session --json 2>/dev/null | jq -r '.sessions[0].sessionId' 2>/dev/null)
  else
    SESSION_ID=$(ccusage session --json 2>/dev/null | jq -r ".sessions[] | select(.sessionId | contains(\"$SESSION_FILTER\")) | .sessionId" 2>/dev/null | head -1)
  fi

  if [ -z "$SESSION_ID" ]; then
    SESSION_ID="unknown"
  fi

  # Export SESSION_ID so it's available to append-cost-metrics.sh
  export SESSION_ID

  # Append metrics
  if bash "${CLAUDE_PLUGIN_ROOT}/scripts/append-cost-metrics.sh" \
    "$METRICS_FILE" "$commit_sha" "$subject" "$cost_delta" > /dev/null 2>&1; then
    local data=$(jq -n --arg file "$METRICS_FILE" '{metrics_file: $file}')
    json_response "success" "$data" "Metrics appended successfully"
  else
    json_response_simple "error" "Failed to append metrics"
    exit 1
  fi
}

# Action: check-gitignore - Check if metrics file is in .gitignore
action_check_gitignore() {
  # Source config to get METRICS_FILE
  export CLAUDE_PLUGIN_ROOT
  source "${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh"

  METRICS_BASENAME=$(basename "$METRICS_FILE")

  if grep -q "^$METRICS_BASENAME$" .gitignore 2>/dev/null; then
    local data=$(jq -n --arg ignored "true" '{ignored: ($ignored == "true")}')
    json_response "success" "$data" "Metrics file is already in .gitignore"
  else
    local data=$(jq -n --arg ignored "false" '{ignored: ($ignored == "false")}')
    json_response "success" "$data" "Metrics file is not in .gitignore"
  fi
}

# Action: add-gitignore - Add metrics file to .gitignore
action_add_gitignore() {
  # Source config to get METRICS_FILE
  export CLAUDE_PLUGIN_ROOT
  source "${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh"

  METRICS_BASENAME=$(basename "$METRICS_FILE")

  if echo "$METRICS_BASENAME" >> .gitignore; then
    json_response_simple "success" "Added $METRICS_BASENAME to .gitignore"
  else
    json_response_simple "error" "Failed to add metrics file to .gitignore"
    exit 1
  fi
}

# Main dispatcher
case "$ACTION" in
  prepare)
    action_prepare
    ;;
  build-message)
    action_build_message "$2" "$3" "$4" "$5" "$6"
    ;;
  create-commit)
    action_create_commit "$2"
    ;;
  append-metrics)
    action_append_metrics "$2" "$3" "$4"
    ;;
  check-gitignore)
    action_check_gitignore
    ;;
  add-gitignore)
    action_add_gitignore
    ;;
  *)
    json_response_simple "error" "Unknown action: $ACTION"
    exit 1
    ;;
esac
