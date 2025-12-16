#!/bin/bash
# Detect build tools and resolve configuration
# Usage: source ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.sh
# Output: Sets DETECTED_TOOLS (JSON array), BUILD_CONFIG (merged config)

set -e

# Validate environment
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq command not found" >&2
  exit 1
fi

# Load merged config (default + project override)
DEFAULT_CONFIG="${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/build-config.json"
PROJECT_CONFIG="./.claude/build-config.json"

if [ ! -f "$DEFAULT_CONFIG" ]; then
  echo "Error: Default config not found at $DEFAULT_CONFIG" >&2
  exit 1
fi

# Create temporary files for merging
DEFAULT_TMP=$(mktemp)
PROJECT_TMP=$(mktemp)
trap "rm -f $DEFAULT_TMP $PROJECT_TMP" EXIT

cat "$DEFAULT_CONFIG" > "$DEFAULT_TMP"
if [ -f "$PROJECT_CONFIG" ]; then
  cat "$PROJECT_CONFIG" > "$PROJECT_TMP"
else
  echo '{}' > "$PROJECT_TMP"
fi

# Merge configs using jq
MERGED_CONFIG=$(jq -s '.[0] * .[1]' "$DEFAULT_TMP" "$PROJECT_TMP")

# Extract all tool names from merged config
TOOLS=$(echo "$MERGED_CONFIG" | jq -r '.tools | keys[]')

if [ -z "$TOOLS" ]; then
  echo "Error: No tools configured in merged config" >&2
  exit 1
fi

# Detect which tools are actually present in the project
DETECTED=()

while IFS= read -r tool; do
  CONFIG_FILE=$(echo "$MERGED_CONFIG" | jq -r ".tools[\"$tool\"].configFile // empty")

  if [ -z "$CONFIG_FILE" ]; then
    continue
  fi

  # Handle glob patterns (e.g., *.csproj)
  if [[ "$CONFIG_FILE" == \** ]]; then
    # It's a glob pattern - use find
    if find . -maxdepth 3 -name "$CONFIG_FILE" -type f 2>/dev/null | grep -q .; then
      DETECTED+=("$tool")
    fi
  else
    # It's a direct file path - check if it exists at root or in subdirectories
    if [ -f "$CONFIG_FILE" ] || find . -maxdepth 2 -name "$(basename "$CONFIG_FILE")" -type f 2>/dev/null | grep -q .; then
      DETECTED+=("$tool")
    fi
  fi
done <<< "$TOOLS"

# If no tools detected, error out
if [ ${#DETECTED[@]} -eq 0 ]; then
  echo "Error: No build tools detected in project" >&2
  exit 1
fi

# Build JSON array of detected tools with their locations
DETECTED_JSON="[]"
for tool in "${DETECTED[@]}"; do
  CONFIG_FILE=$(echo "$MERGED_CONFIG" | jq -r ".tools[\"$tool\"].configFile // empty")

  # Find the actual location of the config file
  if [[ "$CONFIG_FILE" == \** ]]; then
    LOCATION=$(find . -maxdepth 3 -name "$CONFIG_FILE" -type f 2>/dev/null | head -1 | xargs dirname)
  else
    # Check if file exists at root first
    if [ -f "$CONFIG_FILE" ]; then
      LOCATION=$(dirname "$CONFIG_FILE")
    else
      # Search in subdirectories
      LOCATION=$(find . -maxdepth 2 -name "$(basename "$CONFIG_FILE")" -type f 2>/dev/null | head -1 | xargs dirname)
    fi
  fi

  # Normalize location (. means project root)
  if [ "$LOCATION" = "." ]; then
    LOCATION="(project root)"
  fi

  # Add to JSON array with tool config
  TOOL_CONFIG=$(echo "$MERGED_CONFIG" | jq ".tools[\"$tool\"]")
  DETECTED_JSON=$(echo "$DETECTED_JSON" | jq \
    --arg tool "$tool" \
    --arg location "$LOCATION" \
    --argjson config "$TOOL_CONFIG" \
    '. += [{"tool": $tool, "location": $location, "config": $config}]')
done

# Export for use in SKILL.md
export DETECTED_TOOLS="$DETECTED_JSON"
export BUILD_CONFIG="$MERGED_CONFIG"

# Output detected tools as formatted list for user confirmation
echo "Detected build tools:"
echo "$DETECTED_JSON" | jq -r '.[] | "  - \(.tool) (\(.location))"'
