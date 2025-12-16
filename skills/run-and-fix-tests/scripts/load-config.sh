#!/bin/bash
# Load and merge run-and-fix-tests configuration
# Usage: source ${CLAUDE_PLUGIN_ROOT}/skills/scripts/load-config.sh

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

# Export LOG_DIR
export LOG_DIR="${LOG_DIR}"

# Check if build is array (multi-build) or object (single-build)
BUILD_TYPE=$(echo "$CONFIG" | jq -r 'if (.build | type) == "array" then "multi" else "single" end')

if [ "$BUILD_TYPE" == "multi" ]; then
  # Multi-build: export as JSON array for SKILL.md to process
  export BUILD_MULTI=true
  export BUILD_CONFIGS=$(echo "$CONFIG" | jq -c '.build')
  # Count builds
  export BUILD_COUNT=$(echo "$BUILD_CONFIGS" | jq 'length')
else
  # Single-build: export individual variables (backward compatible)
  export BUILD_MULTI=false
  export BUILD_CMD=$(echo "$CONFIG" | jq -r '.build.command')
  export BUILD_LOG=$(echo "$CONFIG" | jq -r '.build.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
  export BUILD_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.build.errorPattern')
  export BUILD_WORKING_DIR=$(echo "$CONFIG" | jq -r '.build.workingDir // "."')
fi

# Test config (unchanged)
export TEST_CMD=$(echo "$CONFIG" | jq -r '.test.all.command')
export TEST_LOG=$(echo "$CONFIG" | jq -r '.test.all.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
export TEST_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.test.all.errorPattern')

export TEST_SINGLE_CMD=$(echo "$CONFIG" | jq -r '.test.single.command')
export TEST_SINGLE_LOG=$(echo "$CONFIG" | jq -r '.test.single.logFile' | sed "s|{logDir}|${LOG_DIR}|g")
export TEST_SINGLE_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.test.single.errorPattern')

# Validate required variables
if [ "$BUILD_MULTI" == "false" ]; then
  if [ -z "$BUILD_CMD" ] || [ -z "$TEST_CMD" ] || [ -z "$TEST_SINGLE_CMD" ]; then
    echo "Error: BUILD_CMD, TEST_CMD, and TEST_SINGLE_CMD must be configured" >&2
    exit 1
  fi
else
  if [ -z "$BUILD_CONFIGS" ] || [ "$BUILD_COUNT" -eq 0 ]; then
    echo "Error: Multi-build config must have at least one build" >&2
    exit 1
  fi
fi
