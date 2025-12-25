#!/bin/bash
# Resolve Plugin Root Script
# Finds the installation path of a Claude Code plugin by reading the installed plugins registry.
#
# NOTE: This script works around Claude Code Issue #9354 where CLAUDE_PLUGIN_ROOT doesn't expand
# in skill markdown files.
# See: https://github.com/anthropics/claude-code/issues/9354
#
# Falls back to CLAUDE_PLUGIN_ROOT environment variable if available (forward compatibility)
#
# Usage: $(./.claude/resolve_plugin_root.sh "plugin-identifier@publisher")
#
# Example:
#   CLAUDE_PLUGIN_ROOT="$(./.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io")"
#   export CLAUDE_PLUGIN_ROOT
#
# This script:
# 1. Checks CLAUDE_PLUGIN_ROOT env var first (for forward compatibility)
# 2. Reads ~/.claude/plugins/installed_plugins.json to find the plugin by identifier
# 3. Outputs the installPath and exits 0 on success
# 4. Exits 1 with error message on failure
#

set -e

PLUGIN_IDENTIFIER="$1"

if [ -z "$PLUGIN_IDENTIFIER" ]; then
  echo "Error: Plugin identifier required. Usage: resolve_plugin_root.sh \"plugin-id@publisher\"" >&2
  exit 1
fi

# Try environment variable first (forward compatibility)
if [ -n "${CLAUDE_PLUGIN_ROOT}" ]; then
  echo "${CLAUDE_PLUGIN_ROOT}"
  exit 0
fi

# Read from installed plugins registry
PLUGINS_REGISTRY="${HOME}/.claude/plugins/installed_plugins.json"

if [ ! -f "$PLUGINS_REGISTRY" ]; then
  echo "Error: Claude plugins registry not found at $PLUGINS_REGISTRY" >&2
  exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "Error: jq command not found. Install jq to use this plugin." >&2
  exit 1
fi

# Extract the installPath for the specified plugin identifier
# Get the first installation entry (most recent based on array order)
PLUGIN_ROOT=$(jq -r ".plugins.\"$PLUGIN_IDENTIFIER\"[0].installPath // empty" "$PLUGINS_REGISTRY" 2>/dev/null)

if [ -z "$PLUGIN_ROOT" ]; then
  echo "Error: Plugin \"$PLUGIN_IDENTIFIER\" not found in installed plugins registry" >&2
  exit 1
fi

if [ ! -d "$PLUGIN_ROOT" ]; then
  echo "Error: Plugin installation path does not exist: $PLUGIN_ROOT" >&2
  exit 1
fi

echo "$PLUGIN_ROOT"
