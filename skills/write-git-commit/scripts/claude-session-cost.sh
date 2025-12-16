#!/bin/bash
# Get current Claude Code session costs
#
# This script:
# 1. Gets current session cost data from ccusage
# 2. Outputs cost array for embedding in commit message
#
# Usage: ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/scripts/claude-session-cost.sh
# Output: JSON cost array: [{"model":"...","inputTokens":N,"outputTokens":N,"cost":N.NN}]
# Example: [{"model":"claude-sonnet-4-5-20250929","inputTokens":1000,"outputTokens":234,"cost":0.45}]

set -e

# Check for required tools
if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  exit 1
fi

# Try to find and use ccusage - try direct, then npx, then bunx
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
  echo "Error: 'ccusage' not found. Install with: npm install -g ccusage" >&2
  echo "Or make sure npm or bun is installed for npx/bunx fallback." >&2
  echo "Visit https://github.com/ryoppippi/ccusage for more information." >&2
  exit 1
fi

# Get current session data and session ID (filter by SESSION_FILTER if configured)
if [ -z "$SESSION_FILTER" ]; then
  # No filter: use first session
  CURRENT=$($CCUSAGE session --json | jq -c '.sessions[0] | {sessionId: .sessionId, cost: (.modelBreakdowns | map({model: .modelName, inputTokens: .inputTokens, outputTokens: .outputTokens, cost: ((.cost * 100 | round) / 100)}))}' 2>/dev/null)
else
  # Filter by configured session name
  CURRENT=$($CCUSAGE session --json | jq -c --arg filter "$SESSION_FILTER" \
    '.sessions[] | select(.sessionId | contains($filter)) | {sessionId: .sessionId, cost: (.modelBreakdowns | map({model: .modelName, inputTokens: .inputTokens, outputTokens: .outputTokens, cost: ((.cost * 100 | round) / 100)}))}'  2>/dev/null | head -1)
fi

if [ -z "$CURRENT" ]; then
  if [ -z "$SESSION_FILTER" ]; then
    echo "Error: Could not find active Claude Code session in ccusage data" >&2
  else
    echo "Error: Could not find Claude Code session matching filter '$SESSION_FILTER' in ccusage data" >&2
  fi
  exit 1
fi

# Extract session ID and cost array from current session
SESSION_ID=$(echo "$CURRENT" | jq -r '.sessionId')
CURRENT_COST=$(echo "$CURRENT" | jq -c '.cost')

# Output current session cost array for commit message
echo "$CURRENT_COST"

# Export SESSION_ID for use by other scripts
export SESSION_ID
