#!/bin/bash
# Load and merge write-git-commit configuration
# Usage: source ./scripts/load-config.sh

# Detect CLAUDE_PLUGIN_ROOT from script location if not set
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  export CLAUDE_PLUGIN_ROOT
fi

DEFAULT=$(cat ${CLAUDE_PLUGIN_ROOT}/skills/write-git-commit/commit-config.json)
PROJECT=$(cat .claude/commit-config.json 2>/dev/null || echo '{}')
CONFIG=$(echo "$DEFAULT" | jq -s '.[0] * .[1]' - <(echo "$PROJECT"))

# Export config variables
export METRICS_FILE=$(echo "$CONFIG" | jq -r '.metricsFile')
export SESSION_FILTER=$(echo "$CONFIG" | jq -r '.sessionFilter // "null"')
