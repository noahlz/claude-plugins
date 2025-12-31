---
name: setup
description: Set up requirements and plugin resolver script for dev-workflow skills. Creates resolve_plugin_root.sh that is required by all dev-workflow skills to resolve plugin paths.
---

This skill checks baseline requirements and sets up the `resolve_plugin_root.sh` script that is required by all dev-workflow skills.

**When to use:**  
Run this skill once after installing the dev-workflow plugin. 

All other dev-workflow skills will then have basline requirements and be able to use the "plugin root resolver" script it creates.

---

## Installation

# 1. Check Node.js version

→ Execute using Bash tool to check Node version:
```bash
if ! command -v node >/dev/null 2>&1; then
  echo "⚠️ Node.js 22+ required"
  echo "Install from https://nodejs.org/"
  exit 1
fi
NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "⚠️ Node.js $(node -v) found, but 22+ required"
  echo "Install from https://nodejs.org/"
  exit 1
fi
```

⚠️ CHECKPOINT: Verify you actually executed Bash tool above
- If you narrated without running Bash: STOP and run the command now
- Check exit code to determine next step

**Result handling:**  
✓ Exit 0 → node minimal version is installed, proceed to step 2  
✗ Exit 1 → node minimal version not found, user must install it first  


**Step description**: "Setting up plugin resolver script"

### 2. Check jq Installation

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
✓ Exit 0 → jq is installed, proceed to step 3  
✗ Exit 1 → jq not found, user must install it first  

### 3. Choose Installation Location

→ Use AskUserQuestion to ask where to install the script:
  - "Install in $HOME/.claude (recommended - available to all projects)"
  - "Install in ./.claude (project-specific only)"

→ Store user choice and determine the install path:
  - If $HOME/.claude: `INSTALL_PATH="$HOME/.claude/resolve_plugin_root.sh"`
  - If ./.claude: `INSTALL_PATH="./.claude/resolve_plugin_root.sh"`


**IMPORTANT** In the following steps, when using the Bash tool, use the literal value of INSTALL_PATH, prefixing any bash commands with the variable setting i.e. `INSTALL_PATH=(path) (bash command)

→ Capture the install path:
```bash
echo INSTALL_PATH=$INSTALL_PATH
```

### 4. Create Directory

→ Execute using Bash tool to create the directory if needed:
```bash
mkdir -p "$(dirname "$INSTALL_PATH")"
```

### 5. Write resolve_plugin_root.sh Script to File

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

### 6. Make Script Executable

→ Execute using Bash tool to make script executable:
```bash
chmod +x "$INSTALL_PATH"
ls -la "$INSTALL_PATH"
```

### 7. Success

→ Display success message:
```
✅ Node v22+ available
✅ jq command available
✅ CLAUDE_PLUGIN_ROOT resolver script created: $INSTALL_PATH

You may now use `dev-workflow` skills
```
