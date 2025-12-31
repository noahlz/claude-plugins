---
name: setup
description: Set up plugin resolver script for dev-workflow skills. Creates resolve_plugin_root.sh that is required by all dev-workflow skills to resolve plugin paths. Workaround for Claude Code issue #9354.
---

This skill sets up the `resolve_plugin_root.sh` script that is required by all dev-workflow skills.

**Why is this needed?**
Due to Claude Code issue #9354, the `${CLAUDE_PLUGIN_ROOT}` variable doesn't expand properly in skill markdown files. This skill creates a helper script that all dev-workflow skills use to resolve the plugin path at runtime.

**What does it do?**
- Checks for jq installation (required dependency)
- Prompts you to choose install location ($HOME/.claude or ./.claude)
- Creates the resolve_plugin_root.sh script
- Makes it executable

**When to use:**
Run this skill once after installing the dev-workflow plugin. All other dev-workflow skills will then use the script it creates.

---

## Installation

**Step description**: "Setting up plugin resolver script"

### 1. Check jq Installation

→ Execute using Bash tool to check for jq:
```bash
if ! command -v jq &> /dev/null; then
  echo "❌ jq not found"
  echo ""
  echo "jq is required to use dev-workflow skills."
  echo ""
  echo "Install with:"
  echo "  macOS: brew install jq"
  echo "  Linux: sudo apt-get install jq"
  echo "  or visit: https://jqlang.github.io/jq/download/"
  exit 1
fi
echo "✓ jq found: $(jq --version)"
```

⚠️ CHECKPOINT: Verify you actually executed Bash tool above
- If you narrated without running Bash: STOP and run the command now
- Check exit code to determine next step

**Result handling:**
✓ Exit 0 → jq is installed, proceed to step 2
✗ Exit 1 → jq not found, user must install it first

### 2. Choose Installation Location

→ Use AskUserQuestion to ask where to install the script:
  - "Install in $HOME/.claude (recommended - available to all projects)"
  - "Install in ./.claude (project-specific only)"

→ Store user choice and determine the install path:
  - If $HOME/.claude: `INSTALL_PATH="$HOME/.claude/resolve_plugin_root.sh"`
  - If ./.claude: `INSTALL_PATH="./.claude/resolve_plugin_root.sh"`

### 3. Create Directory

→ Execute using Bash tool to create the directory if needed:
```bash
mkdir -p "$(dirname "$INSTALL_PATH")"
```

### 4. Write resolve_plugin_root.sh Script to File

→ Write resolve_plugin_root.sh to file using Bash tool with heredoc:
```bash
cat > "$INSTALL_PATH" << 'EOF'
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
# Usage: $(resolve_plugin_root.sh "plugin-identifier@publisher")
#
# Example:
#   CLAUDE_PLUGIN_ROOT="$(resolve_plugin_root.sh "dev-workflow@noahlz.github.io")"
#   export CLAUDE_PLUGIN_ROOT

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
EOF
```

### 5. Make Script Executable

→ Execute using Bash tool to make script executable:
```bash
chmod +x "$INSTALL_PATH"
ls -la "$INSTALL_PATH"
```

### 6. Success

→ Display success message:
```
✅ Plugin resolver script created!

Location: $INSTALL_PATH

All dev-workflow skills can now resolve plugin paths correctly.
You can now use: dev-workflow:run-and-fix-tests and dev-workflow:write-git-commit
```

---

**Background:**
See GitHub issue #9354 for technical details: https://github.com/anthropics/claude-code/issues/9354
