#!/bin/bash
# Shared utilities for run-and-fix-tests scripts
#
# CLAUDE_PLUGIN_ROOT resolution:
# 1. Set by SKILL.md using ./.claude/resolve_plugin_root.sh resolver (preferred)
#    - This works around Claude Code Issue #9354 where CLAUDE_PLUGIN_ROOT doesn't
#      expand in skill markdown files
#    - See: https://github.com/anthropics/claude-code/issues/9354
# 2. Fallback: inferred from script location if not set
#    - Used when scripts are called directly or outside skill execution context

# Detect and set CLAUDE_PLUGIN_ROOT if not already set
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

# Source shared utilities
source "${CLAUDE_PLUGIN_ROOT}/skills/lib/common.sh"
