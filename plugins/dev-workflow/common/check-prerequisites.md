# Prerequisites Check

Execute this to verify all prerequisites are met (Node 22+, plugin installed, config exists).

## Parameters

Pass these before executing:
- `SKILL_NAME`: Skill identifier (e.g., "write-git-commit", "run-and-fix-tests")

## Fast Path Check

→ Check prerequisites inline:
```bash
# 1. Check Node.js version
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 22 ]; then
  echo "⚠️ Setup required"
  exit 1
fi

# 2. Check for resolve_plugin_root.sh script
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  # Script not found - prompt user to install it
  echo "⚠️ Missing resolve_plugin_root.sh script"
  echo ""
  echo "Run this command to install it:"
  echo ""
  echo "  mkdir -p \"\$HOME/.claude\" && curl -fsSL https://raw.githubusercontent.com/noahlz/claude-plugins/refs/heads/main/.claude/resolve_plugin_root.sh -o \"\$HOME/.claude/resolve_plugin_root.sh\" && chmod +x \"\$HOME/.claude/resolve_plugin_root.sh\""
  echo ""
  echo "Then restart this skill."
  exit 0
fi

# 3. Resolve plugin root
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || {
  echo "⚠️ Setup required"
  exit 1
}

# 4. Check config file
if [ ! -f "./.claude/settings.plugins.${SKILL_NAME}.json" ]; then
  echo "⚠️ Setup required"
  exit 1
fi

export CLAUDE_PLUGIN_ROOT
echo "✓ Ready (Node $(node -v))"
```

## Result Handling

**Exit codes:**
- 0: Either (1) all prerequisites met and CLAUDE_PLUGIN_ROOT exported → proceed to Section 1, OR (2) resolver script not found → user should run setup skill
- 1: Prerequisites missing (Node.js wrong version, config missing, or plugin resolver failed) → proceed to Section 0a (setup)

## Slow Path: Setup Prerequisites (First Run Only)

Execute ONLY if fast path returned exit 1.

→ Execute setup instructions from `${CLAUDE_PLUGIN_ROOT}/common/setup-plugin.md`
  - Set SKILL_NAME before executing (already set above)
  - Follow all steps in order (Node check → Plugin root resolution → Config check)

**Result handling:**
- ✓ Exit 0 → Setup complete, CLAUDE_PLUGIN_ROOT exported, proceed to Section 1
- ✗ Exit 1 → Display error: "Node.js 22+ required. Install from https://nodejs.org/ and restart."
- ✗ Exit 2 → Let natural error occur (plugin resolver issue, unexpected)
