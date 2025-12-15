#!/bin/bash
# Calculate Claude Code cost delta since last commit
# Usage: ./scripts/claude-cost-delta.sh
# Output: JSON with delta costs for embedding in commit message

set -e

# Check for required tools
if ! command -v ccusage &> /dev/null; then
  echo "Error: 'ccusage' not found. Install it with: npm install -g ccusage"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' not found. Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

SNAPSHOT_FILE=".claude-cost-snapshot.json"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Get current session data (use the first ligeon session)
CURRENT=$(ccusage session --json | jq -c ".sessions[] | select(.sessionId | contains(\"ligeon\")) | {sessionId, cost: (.modelBreakdowns | map({model: .modelName, tokens: (.inputTokens + .outputTokens + .cacheCreationTokens), cost: .cost})), date: .lastActivity}" | head -1)

if [ -z "$CURRENT" ]; then
  echo "Error: Could not find ligeon session in ccusage data"
  exit 1
fi

# Initialize snapshot file if it doesn't exist
if [ ! -f "$PROJECT_DIR/$SNAPSHOT_FILE" ]; then
  echo "$CURRENT" > "$PROJECT_DIR/$SNAPSHOT_FILE"
  echo "Initialized $SNAPSHOT_FILE"
  echo "Run this script again after your next commit to start tracking deltas"
  exit 0
fi

# Read previous snapshot
PREVIOUS=$(cat "$PROJECT_DIR/$SNAPSHOT_FILE")

# Calculate deltas
DELTA=$(jq -n \
  --argjson current "$CURRENT" \
  --argjson previous "$PREVIOUS" \
  '{
    date: $current.date,
    delta: {
      cost: [
        ($current.cost as $c | $previous.cost as $p |
          $c | map(
            .model as $m |
            ($p | map(select(.model == $m)) | .[0] // {tokens: 0, cost: 0}) as $prev |
            {
              model: .model,
              tokens: (.tokens - $prev.tokens),
              cost: (.cost - $prev.cost)
            }
          )
        )
      ]
    }
  }' | jq -c '.')

# Update snapshot file for next time
echo "$CURRENT" > "$PROJECT_DIR/$SNAPSHOT_FILE"

# Output delta as compact JSON
echo "$DELTA"
