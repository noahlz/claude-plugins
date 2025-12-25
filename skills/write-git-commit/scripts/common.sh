#!/bin/bash
# Shared utilities for write-git-commit scripts
#
# CLAUDE_PLUGIN_ROOT resolution:
# 1. Set by SKILL.md using ./.claude/resolve_plugin_root.sh resolver (preferred)
#    - This works around Claude Code Issue #9354 where CLAUDE_PLUGIN_ROOT doesn't
#      expand in skill markdown files
#    - See: https://github.com/anthropics/claude-code/issues/9354
# 2. Fallback: inferred from script location if not set
#    - Used when scripts are called directly or outside skill execution context

# Source shared utilities from skills/lib
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi
source "${CLAUDE_PLUGIN_ROOT}/skills/lib/common.sh"

# Find ccusage command
# Returns the command to invoke ccusage (e.g., "ccusage", "npx ccusage")
# Exits with error if not found
find_ccusage() {
  if command -v ccusage &> /dev/null; then
    echo "ccusage"
  elif command -v npx &> /dev/null; then
    echo "npx ccusage"
  elif command -v bunx &> /dev/null; then
    echo "bunx ccusage"
  else
    return 1
  fi
}
