#!/bin/bash
# Append cost metrics for a commit to the metrics file
#
# This script appends a single-line JSON entry to the metrics file with:
# - commit SHA (stored as 7-character short SHA)
# - commit subject
# - cost array
# - date
# - session ID (for session continuity tracking)
#
# Usage: ${CLAUDE_PLUGIN_ROOT}/skills/scripts/append-cost-metrics.sh <metrics-file> <commit-sha> <subject> <cost-json-array>
# Example: append-cost-metrics.sh .claude/cost-metrics.json abc123def4567890 "Fix bug" '[{"model":"...","tokens":100,"cost":0.01}]'
# Note: The provided SHA is converted to short SHA (first 7 characters)
#
# Environment:
#   SESSION_ID - Claude Code session ID (optional, defaults to "unknown")

set -e

METRICS_FILE="${1:-.claude/cost-metrics.json}"
COMMIT_SHA="${2}"
SUBJECT="${3}"
COST_ARRAY="${4}"

if [ -z "$COMMIT_SHA" ] || [ -z "$SUBJECT" ] || [ -z "$COST_ARRAY" ]; then
  echo "Error: Missing arguments" >&2
  echo "Usage: append-cost-metrics.sh <metrics-file> <commit-sha> <subject> <cost-json-array>" >&2
  exit 1
fi

# Convert to short SHA (7 characters)
SHORT_SHA="${COMMIT_SHA:0:7}"

if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  exit 1
fi

# Create metrics directory if it doesn't exist
mkdir -p "$(dirname "$METRICS_FILE")"

# Get current date/time in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Create single-line JSON entry and append to metrics file
jq -n \
  --arg commit "$SHORT_SHA" \
  --arg subject "$SUBJECT" \
  --argjson cost "$COST_ARRAY" \
  --arg date "$DATE" \
  --arg session_id "${SESSION_ID:-unknown}" \
  '{commit: $commit, subject: $subject, cost: $cost, date: $date, session_id: $session_id}' \
  | jq -c '.' >> "$METRICS_FILE"
