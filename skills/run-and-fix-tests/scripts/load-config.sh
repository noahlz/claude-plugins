#!/bin/bash
# Load and merge run-and-fix-tests configuration
# Usage: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh

set -e

# Source shared utilities (handles CLAUDE_PLUGIN_ROOT detection and jq check)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Load and merge skill configuration
load_and_merge_skill_config "run-and-fix-tests"
CONFIG="$MERGED_CONFIG"

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
