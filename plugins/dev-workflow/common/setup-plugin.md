# Plugin Setup - First Run Only

Execute ONLY if fast path check failed (exit 1 from main skill file).

Parameters required from skill:
- SKILL_NAME: e.g., "write-git-commit" or "run-and-fix-tests"

## Step 1: Verify Node.js 22+

→ Check Node.js installation and version:
```bash
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found"
  exit 1
fi
NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "❌ Node.js $(node -v) found, but version 22+ required"
  exit 1
fi
echo "✓ Node.js $(node -v) found"
```

✗ Exit 1 → Display error and stop

## Step 2: Resolve Plugin Root

→ Resolve plugin root (attempts to locate resolver script):
```bash
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  echo "Error: resolve_plugin_root.sh not found"
  exit 2
fi
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || {
  echo "Error: Failed to resolve plugin root"
  exit 2
}
export CLAUDE_PLUGIN_ROOT
echo "✓ Plugin root: $CLAUDE_PLUGIN_ROOT"
```

✓ Proceed to step 3

## Step 3: Check Config (Non-blocking)

→ Check if config exists (informational only):
```bash
CONFIG_PATH="./.claude/settings.plugins.${SKILL_NAME}.json"
if [ -f "$CONFIG_PATH" ]; then
  echo "✓ Config found: $CONFIG_PATH"
else
  echo "⚠️  Config missing (will be generated): $CONFIG_PATH"
fi
```

✓ Always proceed (config generation handled by skill)

## Exit Codes

- 0: Node + plugin root ready, CLAUDE_PLUGIN_ROOT exported (config may be missing)
- 1: Node.js missing or too old
- 2: Plugin resolver failed (unexpected)

## Error Messages

- Exit 1: "Node.js 22+ required. Install from https://nodejs.org/ and restart."
