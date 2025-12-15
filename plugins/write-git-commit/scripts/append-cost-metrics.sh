#!/bin/bash
# Append cost metrics for a commit to the metrics file
#
# This script appends a single-line JSON entry to the metrics file with:
# - commit SHA
# - commit subject
# - cost array
# - date
#
# Usage: ${CLAUDE_PLUGIN_ROOT}/scripts/append-cost-metrics.sh <metrics-file> <commit-sha> <subject> <cost-json-array>
# Example: append-cost-metrics.sh .claude/cost-metrics.json abc123def "Fix bug" '[{"model":"...","tokens":100,"cost":0.01}]'

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
  --arg commit "$COMMIT_SHA" \
  --arg subject "$SUBJECT" \
  --argjson cost "$COST_ARRAY" \
  --arg date "$DATE" \
  '{commit: $commit, subject: $subject, cost: $cost, date: $date}' \
  | jq -c '.' >> "$METRICS_FILE"
