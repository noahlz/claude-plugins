#!/bin/bash
# Calculate Claude Code cost delta for commit
#
# This script:
# 1. Gets current session cost data from ccusage
# 2. Reads the last recorded entry from metrics file (if exists)
# 3. Calculates delta (current - previous)
# 4. Outputs cost array for embedding in commit message
#
# Usage: ${CLAUDE_PLUGIN_ROOT}/skills/scripts/claude-cost-delta.sh <metrics-file>
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

# Get current session data and session ID (filter by SESSION_FILTER if configured)
if [ "$SESSION_FILTER" = "null" ] || [ -z "$SESSION_FILTER" ]; then
  # No filter: use first session
  CURRENT=$(ccusage session --json | jq -c ".sessions[0] | {sessionId: .sessionId, cost: (.modelBreakdowns | map({model: .modelName, tokens: (.inputTokens + .outputTokens + .cacheCreationTokens), cost: ((.cost * 100 | round) / 100)}))}")
else
  # Filter by configured session name
  CURRENT=$(ccusage session --json | jq -c ".sessions[] | select(.sessionId | contains(\"$SESSION_FILTER\")) | {sessionId: .sessionId, cost: (.modelBreakdowns | map({model: .modelName, tokens: (.inputTokens + .outputTokens + .cacheCreationTokens), cost: ((.cost * 100 | round) / 100)}))}" | head -1)
fi

if [ -z "$CURRENT" ]; then
  if [ "$SESSION_FILTER" = "null" ] || [ -z "$SESSION_FILTER" ]; then
    echo "Error: Could not find active Claude Code session in ccusage data" >&2
  else
    echo "Error: Could not find Claude Code session matching filter '$SESSION_FILTER' in ccusage data" >&2
  fi
  exit 1
fi

# Extract session ID and cost array from current session
SESSION_ID=$(echo "$CURRENT" | jq -r '.sessionId')
CURRENT_COST=$(echo "$CURRENT" | jq -c '.cost')

# If metrics file doesn't exist, this is the first commit
if [ ! -f "$METRICS_FILE" ]; then
  # First run: output current cost as delta (no previous data to subtract)
  echo "$CURRENT_COST"
  exit 0
fi

# Read all entries from metrics file (NDJSON format - one JSON per line)
# Sum all previous deltas for the current session
if [ ! -s "$METRICS_FILE" ]; then
  # File exists but is empty: output current cost as delta
  echo "$CURRENT_COST"
  exit 0
fi

# Sum all previous deltas for the current session
# Filter by exact session_id match, then aggregate costs by model
PREVIOUS_COST=$(cat "$METRICS_FILE" | jq -s \
  --arg session_id "$SESSION_ID" \
  '[
    .[] |
    select(.session_id == $session_id) |
    .cost[]
  ] |
  if length == 0 then
    []
  else
    group_by(.model) |
    map({
      model: .[0].model,
      tokens: (map(.tokens) | add),
      cost: ((map(.cost * 100 | round) | add) / 100)
    })
  end'
)

# Calculate deltas for each model (current - previous)
# Round cost to 2 decimal places
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
        cost: (((.cost - $prev.cost) * 100 | round) / 100)
      }
    )
  ' | jq -c '.')

# Validate delta - check for negative values
NEGATIVE_MODELS=$(echo "$DELTA" | jq '[.[] | select(.tokens < 0 or .cost < 0)] | length')

if [ "$NEGATIVE_MODELS" -gt 0 ]; then
  # Negative delta detected - write warning to stderr with raw values
  echo "WARNING: Negative cost delta detected. This typically happens when:" >&2
  echo "  - Claude Code session was restarted" >&2
  echo "  - Cache was invalidated between commits" >&2
  echo "  - Multiple sessions with same filter active" >&2
  echo "" >&2
  echo "Current session costs vs last recorded:" >&2
  echo "$DELTA" | jq '.[] | select(.tokens < 0 or .cost < 0) | "  - \(.model): \(.tokens) tokens, $\(.cost)"' -r >&2
  echo "" >&2

  # Output delta cost array to stdout (so skill can process it)
  echo "$DELTA"

  # Return special error status for negative delta
  # Use exit code 2 to distinguish from other errors
  exit 2
fi

# Output delta cost array for commit message
echo "$DELTA"
