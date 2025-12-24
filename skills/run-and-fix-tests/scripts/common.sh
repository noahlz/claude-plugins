#!/bin/bash
# Shared utilities for run-and-fix-tests scripts
# Sources shared utilities from skills/lib

# Detect and set CLAUDE_PLUGIN_ROOT
if [ -z "${CLAUDE_PLUGIN_ROOT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

# Source shared utilities
source "${CLAUDE_PLUGIN_ROOT}/skills/lib/common.sh"
