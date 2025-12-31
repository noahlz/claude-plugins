# Prerequisites Check

Execute this to verify basic prerequisites are met (plugin root known, Node 22+)

## Fast Path Check

→ Check prerequisites inline:
```bash
# 1. Check for resolve_plugin_root.sh script
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  # Script not found - prompt user to install it
  echo "⚠️ Missing resolve_plugin_root.sh script"
  echo ""
  echo "Install it with the `dev-workflow:setup`, then retry this skill."
  echo ""
  exit 0
fi

# 2. Resolve plugin root
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || {
  echo "⚠️ Setup required"
  exit 1
}

# 3. Check Node.js version
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 22 ]; then
  echo "⚠️ Setup required"
  exit 1
fi

export CLAUDE_PLUGIN_ROOT
echo "✓ Ready (Node $(node -v))"
```

## Result Handling

**Exit codes:**
- 0: Either (1) all prerequisites met and CLAUDE_PLUGIN_ROOT exported → proceed to Section 1, OR (2) resolver script not found → user should run setup skill
- 1: Prerequisites missing (Node.js wrong version or plugin resolver failed) → proceed to Section 0a (setup)

## Slow Path: Setup Prerequisites (First Run Only)

Execute ONLY if fast path returned exit 1.

→ Execute setup instructions from `${CLAUDE_PLUGIN_ROOT}/common/setup-plugin.md`
  - Set SKILL_NAME before executing (already set above)
  - Follow all steps in order (Node check → Plugin root resolution → Config check)

**Result handling:**
- ✓ Exit 0 → Setup complete, CLAUDE_PLUGIN_ROOT exported, proceed to Section 1
- ✗ Exit 1 → Display error: "Node.js 22+ required. Install from https://nodejs.org/ and restart."
