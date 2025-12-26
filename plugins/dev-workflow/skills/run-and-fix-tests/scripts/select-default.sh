#!/bin/bash
# Select and apply appropriate default configuration based on detected tools
# Usage: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/select-default.sh
# Input: DETECTED_TOOLS (JSON array from detect-and-resolve.sh)
# Output: Creates .claude/settings.plugins.run-and-fix-tests.json

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Helper function: Select single tool default
select_single_tool_default() {
  local TOOL_NAME=$(echo "$DETECTED_TOOLS" | jq -r '.[0].tool')
  local DEFAULT_FILE="${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/defaults/${TOOL_NAME}.json"

  if [ -f "$DEFAULT_FILE" ]; then
    # Copy the tool-specific default
    cp "$DEFAULT_FILE" ".claude/settings.plugins.run-and-fix-tests.json"
    echo "✅ Using $TOOL_NAME default configuration"
  else
    # No default exists for this tool - use placeholder template
    echo "⚠️  No default found for $TOOL_NAME"
    echo "📝 Creating template config - YOU MUST CUSTOMIZE IT BEFORE USE"
    cp "${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/defaults/TEMPLATE.json" \
       ".claude/settings.plugins.run-and-fix-tests.json"
    echo ""
    echo "🚨 PLACEHOLDER CONFIG CREATED - YOU MUST CUSTOMIZE IT"
    echo "   Edit: .claude/settings.plugins.run-and-fix-tests.json"
    echo "   Replace all __PLACEHOLDER_*__ values with your build/test commands"
    echo ""
  fi
}

# Helper function: Generate polyglot configuration for multiple tools
select_multi_tool_default() {
  local LOCATIONS=$(echo "$DETECTED_TOOLS" | jq -r '.[].location' | sort -u)
  local LOCATION_COUNT=$(echo "$LOCATIONS" | wc -l)

  # Show emoji notification
  echo "🔧 Multiple build tools detected, creating polyglot configuration..."
  echo ""

  # Load polyglot template
  local TEMPLATE="${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/defaults/polyglot.json"

  if [ ! -f "$TEMPLATE" ]; then
    echo "Error: polyglot.json template not found" >&2
    return 1 2>/dev/null || exit 1
  fi

  # Build array of tool configs
  local BUILD_ARRAY="[]"
  local TOOL_CONFIGS=""

  for i in $(seq 0 $((TOOL_COUNT - 1))); do
    local TOOL_NAME=$(echo "$DETECTED_TOOLS" | jq -r ".[$i].tool")
    local LOCATION=$(echo "$DETECTED_TOOLS" | jq -r ".[$i].location")
    local TOOL_DEFAULT="${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/defaults/${TOOL_NAME}.json"

    echo "  - $TOOL_NAME at $LOCATION"

    if [ -f "$TOOL_DEFAULT" ]; then
      # Extract build config from tool default
      local BUILD_ENTRY=$(jq --arg wd "$LOCATION" '.build | . + {workingDir: $wd}' "$TOOL_DEFAULT")
      BUILD_ARRAY=$(echo "$BUILD_ARRAY" | jq ". += [$BUILD_ENTRY]")
    else
      echo "    ⚠️  Warning: No default for $TOOL_NAME, skipping from polyglot"
    fi
  done

  # Create polyglot config from template
  jq --argjson builds "$BUILD_ARRAY" \
     '.build = $builds' \
     "$TEMPLATE" > ".claude/settings.plugins.run-and-fix-tests.json"

  echo ""
  echo "✅ Created polyglot configuration with $(echo "$BUILD_ARRAY" | jq 'length') build tools"
  echo "📝 Review and customize .claude/settings.plugins.run-and-fix-tests.json as needed"
}

# Check if project config already exists
if [ -f ".claude/settings.plugins.run-and-fix-tests.json" ]; then
  # Config already exists, nothing to do
  return 0 2>/dev/null || exit 0
fi

# Parse DETECTED_TOOLS to count tools
TOOL_COUNT=$(echo "$DETECTED_TOOLS" | jq 'length')

if [ "$TOOL_COUNT" -eq 0 ]; then
  echo "Error: No tools detected in project" >&2
  return 1 2>/dev/null || exit 1
elif [ "$TOOL_COUNT" -eq 1 ]; then
  # Single tool detected - use matching default
  select_single_tool_default
else
  # Multiple tools detected - generate polyglot config
  select_multi_tool_default
fi
