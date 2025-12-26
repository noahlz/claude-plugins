#!/bin/bash
# Shared utilities for skill scripts
#
# CLAUDE_PLUGIN_ROOT resolution strategy:
# 1. SKILL.md files set CLAUDE_PLUGIN_ROOT using ./.claude/resolve_plugin_root.sh
#    - This resolver reads ~/.claude/plugins/installed_plugins.json
#    - Works around Claude Code Issue #9354 where CLAUDE_PLUGIN_ROOT doesn't
#      expand in skill markdown files
#    - See: https://github.com/anthropics/claude-code/issues/9354
# 2. Fallback: Scripts detect plugin root from file location
#    - Used when called directly or outside skill execution
#
# Usage: source "${CLAUDE_PLUGIN_ROOT}/skills/lib/common.sh"

# Detect CLAUDE_PLUGIN_ROOT from script location if not set
# Exports: CLAUDE_PLUGIN_ROOT
detect_plugin_root() {
  if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
    CLAUDE_PLUGIN_ROOT="$(cd "$script_dir/../../.." && pwd)"
    export CLAUDE_PLUGIN_ROOT
  fi
}

# Check if jq command is available
# Exits with error if not found
# Usage: check_jq
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo "Error: jq command not found. Install jq to use this plugin." >&2
    exit 1
  fi
}

# Generic command checker
# Usage: check_command "command-name" "Error message"
check_command() {
  local cmd="$1"
  local error_msg="${2:-Error: $cmd command not found}"

  if ! command -v "$cmd" &> /dev/null; then
    echo "$error_msg" >&2
    return 1
  fi
}

# Load and merge skill configuration
# Merges default skill config with project-specific config
# Usage: load_and_merge_skill_config "skill-name"
# Exports: MERGED_CONFIG
load_and_merge_skill_config() {
  local skill_name="$1"

  if [ -z "$skill_name" ]; then
    echo "Error: skill_name parameter required" >&2
    return 1
  fi

  detect_plugin_root
  check_jq

  local default_config="${CLAUDE_PLUGIN_ROOT}/skills/${skill_name}/settings.plugins.${skill_name}.json"
  local project_config="./.claude/settings.plugins.${skill_name}.json"

  if [ ! -f "$default_config" ]; then
    echo "Error: Default config not found at $default_config" >&2
    return 1
  fi

  # Create temporary files for merging with cleanup
  local default_tmp
  local project_tmp
  default_tmp=$(mktemp)
  project_tmp=$(mktemp)
  trap "rm -f $default_tmp $project_tmp" RETURN

  cat "$default_config" > "$default_tmp"
  if [ -f "$project_config" ]; then
    cat "$project_config" > "$project_tmp"
  else
    echo '{}' > "$project_tmp"
  fi

  # Merge configs using jq
  MERGED_CONFIG=$(jq -s '.[0] * .[1]' "$default_tmp" "$project_tmp")
  export MERGED_CONFIG
}

# Output JSON response with status, data, and message
# Usage: json_response "success" '{"key":"value"}' "Operation completed"
json_response() {
  local status="$1"
  local data="$2"
  local message="$3"

  jq -n \
    --arg status "$status" \
    --argjson data "$data" \
    --arg message "$message" \
    '{status: $status, data: $data, message: $message}'
}

# Output JSON response with status and message (empty data)
# Usage: json_response_simple "success" "Operation completed"
json_response_simple() {
  local status="$1"
  local message="$2"

  jq -n \
    --arg status "$status" \
    --arg message "$message" \
    '{status: $status, data: {}, message: $message}'
}