#!/bin/bash
# Load and merge run-and-fix-tests configuration
# Usage: source ${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh

# Validate environment
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
  exit 1
fi

# Check jq availability
if ! command -v jq &> /dev/null; then
  echo "Error: jq command not found. Install jq to use this plugin." >&2
  exit 1
fi

# Load and merge configs
DEFAULT=$(cat "${CLAUDE_PLUGIN_ROOT}/build-config.json")
PROJECT=$(cat .claude/build-config.json 2>/dev/null || echo '{}')
CONFIG=$(echo "$DEFAULT" | jq -s '.[0] * .[1]' - <(echo "$PROJECT"))

# Extract logDir first
LOG_DIR=$(echo "$CONFIG" | jq -r '.logDir // "dist"')

# Export config variables with placeholder resolution
export BUILD_CMD=$(echo "$CONFIG" | jq -r '.build.command')
export BUILD_LOG=$(echo "$CONFIG" | jq -r '.build.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
export BUILD_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.build.errorPattern')

export TEST_CMD=$(echo "$CONFIG" | jq -r '.test.all.command')
export TEST_LOG=$(echo "$CONFIG" | jq -r '.test.all.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
export TEST_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.test.all.errorPattern')

export TEST_SINGLE_CMD=$(echo "$CONFIG" | jq -r '.test.single.command')
export TEST_SINGLE_LOG=$(echo "$CONFIG" | jq -r '.test.single.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
export TEST_SINGLE_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.test.single.errorPattern')

export LOG_DIR="${LOG_DIR}"

# Validate required variables are set
if [ -z "$BUILD_CMD" ] || [ -z "$TEST_CMD" ] || [ -z "$TEST_SINGLE_CMD" ]; then
  echo "Error: BUILD_CMD, TEST_CMD, and TEST_SINGLE_CMD must be configured" >&2
  exit 1
fi
