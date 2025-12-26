#!/bin/bash
# Load and output run-and-fix-tests configuration as eval-able statements
# Usage: eval "$(./load-config.sh <plugin-root-path>)"
#
# This script outputs shell export statements instead of directly setting variables.
# This eliminates BASH_SOURCE fragility and works reliably in all execution contexts.

CLAUDE_PLUGIN_ROOT="${1}"

if [ -z "$CLAUDE_PLUGIN_ROOT" ]; then
  echo "Error: CLAUDE_PLUGIN_ROOT required as first argument" >&2
  echo "Usage: eval \"\$(./load-config.sh <plugin-root-path>)\"" >&2
  exit 1
fi

if [ ! -d "$CLAUDE_PLUGIN_ROOT" ]; then
  echo "Error: CLAUDE_PLUGIN_ROOT directory does not exist: $CLAUDE_PLUGIN_ROOT" >&2
  exit 1
fi

# Verify jq is available (needed for JSON processing)
if ! command -v jq &> /dev/null; then
  echo "Error: jq command not found. Install jq to use this script." >&2
  exit 1
fi

# For execution, we only use the project config (no merging with universal default)
# The universal default is only for detection by detect-and-resolve.sh
if [ ! -f ".claude/settings.plugins.run-and-fix-tests.json" ]; then
  echo "Error: No project configuration found at .claude/settings.plugins.run-and-fix-tests.json" >&2
  echo "Run the detection script first: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.sh" >&2
  return 1 2>/dev/null || exit 1
fi

# Load only the project config (flat structure)
CONFIG=$(cat .claude/settings.plugins.run-and-fix-tests.json)

# Validate buildTools array exists
if ! echo "$CONFIG" | jq -e '.buildTools' > /dev/null 2>&1; then
  echo "Error: Config must have 'buildTools' array" >&2
  exit 1
fi

# Extract and validate buildTools array
BUILD_TOOLS_COUNT=$(echo "$CONFIG" | jq '.buildTools | length')
if [ "$BUILD_TOOLS_COUNT" -eq 0 ]; then
  echo "Error: buildTools array is empty" >&2
  exit 1
fi

# Extract BUILD_MULTI flag
BUILD_MULTI=$(echo "$CONFIG" | jq -r '.buildMulti // false')
printf 'export BUILD_MULTI=%q\n' "$BUILD_MULTI"

# For single-build (first tool in array)
if [ "$BUILD_MULTI" == "false" ] || [ "$BUILD_TOOLS_COUNT" -eq 1 ]; then
  BUILD_CMD=$(echo "$CONFIG" | jq -r '.buildTools[0].buildCmd')
  BUILD_LOG=$(echo "$CONFIG" | jq -r '.buildTools[0].buildLog')
  BUILD_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.buildTools[0].buildErrorPattern')
  BUILD_WORKING_DIR=$(echo "$CONFIG" | jq -r '.buildTools[0].buildWorkingDir // "."')

  TEST_CMD=$(echo "$CONFIG" | jq -r '.buildTools[0].testCmd')
  TEST_LOG=$(echo "$CONFIG" | jq -r '.buildTools[0].testLog')
  TEST_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.buildTools[0].testErrorPattern')

  TEST_SINGLE_CMD=$(echo "$CONFIG" | jq -r '.buildTools[0].testSingleCmd')
  TEST_SINGLE_LOG=$(echo "$CONFIG" | jq -r '.buildTools[0].testSingleLog')
  TEST_SINGLE_ERROR_PATTERN=$(echo "$CONFIG" | jq -r '.buildTools[0].testSingleErrorPattern')

  LOG_DIR=$(echo "$CONFIG" | jq -r '.buildTools[0].logDir // "dist"')

  # Output assignments using printf %q for safe quoting
  printf 'export BUILD_CMD=%q\n' "$BUILD_CMD"
  printf 'export BUILD_LOG=%q\n' "$BUILD_LOG"
  printf 'export BUILD_ERROR_PATTERN=%q\n' "$BUILD_ERROR_PATTERN"
  printf 'export BUILD_WORKING_DIR=%q\n' "$BUILD_WORKING_DIR"
  printf 'export TEST_CMD=%q\n' "$TEST_CMD"
  printf 'export TEST_LOG=%q\n' "$TEST_LOG"
  printf 'export TEST_ERROR_PATTERN=%q\n' "$TEST_ERROR_PATTERN"
  printf 'export TEST_SINGLE_CMD=%q\n' "$TEST_SINGLE_CMD"
  printf 'export TEST_SINGLE_LOG=%q\n' "$TEST_SINGLE_LOG"
  printf 'export TEST_SINGLE_ERROR_PATTERN=%q\n' "$TEST_SINGLE_ERROR_PATTERN"
  printf 'export LOG_DIR=%q\n' "$LOG_DIR"

  # Validate
  if [ -z "$BUILD_CMD" ] || [ -z "$TEST_CMD" ] || [ -z "$TEST_SINGLE_CMD" ]; then
    echo "Error: BUILD_CMD, TEST_CMD, and TEST_SINGLE_CMD must be configured" >&2
    exit 1
  fi
else
  # Multi-build: not yet implemented
  echo "Error: Multi-build configuration not yet implemented" >&2
  exit 1
fi
