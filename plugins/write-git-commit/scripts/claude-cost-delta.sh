#!/bin/bash
# Calculate Claude Code cost delta for commit
#
# This script:
# 1. Gets current session cost data from ccusage
# 2. Reads the last recorded entry from metrics file (if exists)
# 3. Calculates delta (current - previous)
# 4. Outputs cost array for embedding in commit message
#
# Usage: ${CLAUDE_PLUGIN_ROOT}/scripts/claude-cost-delta.sh <metrics-file>
# Output: JSON cost array for commit message: [{"model":"...","tokens":N,"cost":N.NN}]
# Example: [{"model":"claude-sonnet-4-5-20250929","tokens":1234,"cost":0.45}]
# Dates: ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)

set -e

# Get metrics file path from argument
METRICS_FILE="${1:-.claude/cost-metrics.json}"

# Check for required tools
if ! command -v ccusage &> /dev/null; then
  echo "Error: 'ccusage' not found. Install with: npm install -g ccusage" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  exit 1
fi

# Get current session data (find the first ligeon session)
CURRENT=$(ccusage session --json | jq -c ".sessions[] | select(.sessionId | contains(\"ligeon\")) | {cost: (.modelBreakdowns | map({model: .modelName, tokens: (.inputTokens + .outputTokens + .cacheCreationTokens), cost: .cost}))}" | head -1)

if [ -z "$CURRENT" ]; then
  echo "Error: Could not find active ligeon session in ccusage data" >&2
  exit 1
fi

# Extract cost array from current session
CURRENT_COST=$(echo "$CURRENT" | jq -c '.cost')

# If metrics file doesn't exist, this is the first commit
if [ ! -f "$METRICS_FILE" ]; then
  # First run: output current cost as delta (no previous data to subtract)
  echo "$CURRENT_COST"
  exit 0
fi

# Read last entry from metrics file (NDJSON format - one JSON per line)
LAST_ENTRY=$(tail -1 "$METRICS_FILE")

if [ -z "$LAST_ENTRY" ]; then
  # File exists but is empty: output current cost as delta
  echo "$CURRENT_COST"
  exit 0
fi

# Extract cost array from last entry
PREVIOUS_COST=$(echo "$LAST_ENTRY" | jq -c '.cost // []')

# Calculate deltas for each model (current - previous)
DELTA=$(jq -n \
  --argjson current "$CURRENT_COST" \
  --argjson previous "$PREVIOUS_COST" \
  '
    $current | map(
      .model as $m |
      ($previous | map(select(.model == $m)) | .[0] // {tokens: 0, cost: 0}) as $prev |
      {
        model: .model,
        tokens: (.tokens - $prev.tokens),
        cost: (.cost - $prev.cost)
      }
    )
  ' | jq -c '.')

# Output delta cost array for commit message
echo "$DELTA"
