#!/bin/bash
# Verify exact session ID exists in ccusage
# Usage: verify-session.sh <session_id>
# Output: JSON with status

set -e

SESSION_ID="${1:-}"

if [ -z "$SESSION_ID" ]; then
  jq -n '{status: "error", message: "No session ID provided"}'
  exit 1
fi

# Find ccusage (existing pattern from claude-session-cost.sh)
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

CCUSAGE=$(find_ccusage 2>/dev/null)
if [ -z "$CCUSAGE" ]; then
  jq -n '{status: "error", message: "ccusage not found. Install with: npm install -g ccusage"}'
  exit 1
fi

# Check for exact match using --jq
EXACT_MATCH=$($CCUSAGE session --jq ".sessions[] | select(.sessionId == \"$SESSION_ID\") | .sessionId" 2>/dev/null | head -1)

if [ -n "$EXACT_MATCH" ]; then
  jq -n --arg id "$EXACT_MATCH" '{status: "verified", data: {session_id: $id}}'
  exit 0
else
  jq -n --arg id "$SESSION_ID" '{status: "not_found", data: {attempted_id: $id}, message: "Session not found in ccusage data"}'
  exit 0
fi
