#!/bin/bash
# Get current session costs for exact SESSION_ID
# Usage: claude-session-cost.sh
# Requires: SESSION_ID environment variable
# Output: JSON cost array

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

if [ -z "$SESSION_ID" ]; then
  echo "Error: SESSION_ID environment variable not set" >&2
  exit 1
fi

CCUSAGE=$(find_ccusage 2>/dev/null)
if [ -z "$CCUSAGE" ]; then
  echo "Error: ccusage not found. Install with: npm install -g ccusage" >&2
  exit 1
fi

# Use --jq to extract costs for exact session
JQ_EXPR=".sessions[] | select(.sessionId == \"$SESSION_ID\") | .modelBreakdowns | map({model: .modelName, inputTokens: .inputTokens, outputTokens: .outputTokens, cost: ((.cost * 100 | round) / 100)})"
CURRENT_COST=$($CCUSAGE session --jq "$JQ_EXPR" 2>/dev/null)

if [ -z "$CURRENT_COST" ]; then
  echo "Error: Session '$SESSION_ID' not found in ccusage data" >&2
  exit 1
fi

echo "$CURRENT_COST"
