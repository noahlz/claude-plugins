#!/bin/bash
# Load and merge run-and-fix-tests configuration
# Usage: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh

# Source shared utilities (handles CLAUDE_PLUGIN_ROOT detection and jq check)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# For execution, we only use the project config (no merging with universal default)
# The universal default is only for detection by detect-and-resolve.sh
if [ ! -f ".claude/settings.plugins.run-and-fix-tests.json" ]; then
  echo "Error: No project configuration found at .claude/settings.plugins.run-and-fix-tests.json" >&2
  echo "Run the detection script first: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.sh" >&2
  return 1 2>/dev/null || exit 1
fi

# Load only the project config (flat structure)
CONFIG=$(cat .claude/settings.plugins.run-and-fix-tests.json)

# Validate config structure - ensure it's flat, not nested under "tools"
if echo "$CONFIG" | jq -e '.tools' > /dev/null 2>&1; then
  echo "Error: Config has 'tools' wrapper. Please use flat structure from defaults/ directory." >&2
  echo "Run detection again or copy from skills/run-and-fix-tests/defaults/{tool}.json" >&2
  return 1 2>/dev/null || exit 1
fi

# Validate that placeholders have been replaced
if echo "$CONFIG" | grep -q "__PLACEHOLDER_"; then
  echo "" >&2
  echo "🚨🚨🚨 CONFIGURATION REQUIRED 🚨🚨🚨" >&2
  echo "" >&2
  echo "Your config file contains placeholder values that must be replaced." >&2
  echo "Edit: .claude/settings.plugins.run-and-fix-tests.json" >&2
  echo "" >&2
  echo "Replace all __PLACEHOLDER_*__ values with your project's actual:" >&2
  echo "  - Build commands (e.g., 'mvn clean install', 'npm run build')" >&2
  echo "  - Test commands (e.g., 'mvn test', 'npm test')" >&2
  echo "  - Error patterns (regex to detect failures in logs)" >&2
  echo "  - Log directory and file names" >&2
  echo "" >&2
  echo "See defaults/ directory for examples: maven.json, npm.json, gradle.json, etc." >&2
  echo "" >&2
  return 1 2>/dev/null || exit 1
fi

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
    return 1 2>/dev/null || exit 1
  fi
else
  if [ -z "$BUILD_CONFIGS" ] || [ "$BUILD_COUNT" -eq 0 ]; then
    echo "Error: Multi-build config must have at least one build" >&2
    return 1 2>/dev/null || exit 1
  fi
fi
