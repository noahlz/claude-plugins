#!/bin/bash
# Shared utilities for write-git-commit scripts

# Find ccusage command
# Returns the command to invoke ccusage (e.g., "ccusage", "npx ccusage")
# Exits with error if not found
find_ccusage() {
  if command -v ccusage &> /dev/null; then
    echo "ccusage"
  elif command -v npx &> /dev/null; then
    echo "npx ccusage"
  elif command -v bunx &> /dev/null; then
    echo "bunx ccusage"
  else
    return 1
  fi
}

# Output JSON response with status, data, and message
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

# Output JSON response with status and message (empty data)
json_response_simple() {
  local status="$1"
  local message="$2"

  jq -n \
    --arg status "$status" \
    --arg message "$message" \
    '{status: $status, data: {}, message: $message}'
}
