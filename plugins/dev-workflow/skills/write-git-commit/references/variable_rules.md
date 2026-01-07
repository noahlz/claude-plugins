**⚠️ CRITICAL - Capture these values for substitution throughout the skill:**

- `CLAUDE_PLUGIN_ROOT` - the literal path of this plugin.
- `SESSION_ID` - either:
  - The configured session ID from `.claude/settings.plugins.write-git-commit.json`, OR
  - "NOT_CONFIGURED" (will be auto-detected later)

**You MUST:**
1. Store the `CLAUDE_PLUGIN_ROOT` literal path value - you will use it to replace **`__PLUGIN_ROOT__`** in bash commands below
2. Store the `SESSION_ID` literal value - you will use it to replace **`__SESSION_ID__`** in bash commands below
3. In ALL bash commands throughout this skill:
   - Replace **`__PLUGIN_ROOT__`** with the exact literal path shown above
   - Replace **`__SESSION_ID__`** with the exact literal value shown above
4. Examples:
   - If `CLAUDE_PLUGIN_ROOT` shows `/Users/username/.claude/plugins/cache/dev-workflow/0.1.0`, then replace every **`__PLUGIN_ROOT__`** → `/Users/username/.claude/plugins/cache/dev-workflow/0.1.0`
   - If `SESSION_ID` shows `-Users-noahlz-projects-claude-plugins`, then replace every **`__SESSION_ID__`** → `-Users-noahlz-projects-claude-plugins`
