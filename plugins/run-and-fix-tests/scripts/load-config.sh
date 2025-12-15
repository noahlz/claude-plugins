#!/bin/bash
# Load and merge run-and-fix-tests configuration
# Usage: source ./scripts/load-config.sh

DEFAULT=$(cat ${CLAUDE_PLUGIN_ROOT}/build-config.json)
PROJECT=$(cat .claude/build-config.json 2>/dev/null || echo '{}')
CONFIG=$(echo "$DEFAULT" | jq -s '.[0] * .[1]' - <(echo "$PROJECT"))

# Export config variables
export BUILD_CMD=$(echo "$CONFIG" | jq -r '.build.command')
export BUILD_LOG=$(echo "$CONFIG" | jq -r '.build.logFile')
export BUILD_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.build.errorPattern')
export TEST_CMD=$(echo "$CONFIG" | jq -r '.test.all.command')
export TEST_LOG=$(echo "$CONFIG" | jq -r '.test.all.logFile')
export TEST_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.test.all.errorPattern')
