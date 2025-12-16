#!/bin/bash
# Load and merge write-git-commit configuration
# Usage: source ./scripts/load-config.sh

DEFAULT=$(cat ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/commit-config.json)
PROJECT=$(cat .claude/commit-config.json 2>/dev/null || echo '{}')
CONFIG=$(echo "$DEFAULT" | jq -s '.[0] * .[1]' - <(echo "$PROJECT"))

# Export config variables
export METRICS_FILE=$(echo "$CONFIG" | jq -r '.metricsFile')
export SESSION_FILTER=$(echo "$CONFIG" | jq -r '.sessionFilter // "null"')
