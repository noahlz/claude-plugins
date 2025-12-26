# Claude Code Plugins

Productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

## Available Plugins

### write-git-commit
Create git commits with Claude Code cost metrics embedded in commit footers.

**Command:** `/commit`

NOTE: Requires local installation of [`ccusage`](https://github.com/ryoppippi/ccusage)

### run-and-fix-tests
Run tests with clean output and fix any failures.

**Command:** `/test`

### test-runner-fixer (Agent)
Analyze failing tests and implement root-cause fixes. Guides compilation error resolution and test failure diagnosis.

**Invocation:** Use when user asks to run/fix tests or when new/changed code needs validation. Uses the `run-and-fix-tests` skill. 

## Installation

Add the marketplace to your Claude Code settings:

```bash
claude plugin marketplace add https://github.com/noahlz/claude-plugins.git
claude plugin install dev-workflow@noahlz.github.com
```

## Development

### Local Development Setup

When developing these plugins, you can test them locally using the marketplace path:

```bash
# From the claude-plugins directory, add the local marketplace
claude plugin marketplace add .
```

### Plugin Reinstallation

When making changes to plugin code, you must fully uninstall and reinstall the plugin for changes to take effect. Run the provided script `./reinstall.sh`

Alternatively, update the plugin version number in `marketplace.json` and then trigger a marketplace/plugin update in Claude Code.

### Shared Utilities

All skill scripts source shared utilities from [`plugins/dev-workflow/skills/lib/common.sh`](./plugins/dev-workflow/skills/lib/common.sh). When adding new skills or utilities:
- Add generic, reusable functions to [`plugins/dev-workflow/skills/lib/common.sh`](./plugins/dev-workflow/skills/lib/common.sh)
- Create a skill-specific `scripts/common.sh` that sources the library and adds skill-specific helpers
- This keeps code DRY and ensures consistent patterns across skills

### Plugin Root Resolution

Skills need to locate the plugin installation directory to source their scripts. Claude Code's `CLAUDE_PLUGIN_ROOT` environment variable [doesn't work in command markdown files](https://github.com/anthropics/claude-code/issues/9354).

**The Problem:**
- **Source location** (development): Plugin code lives in `plugins/dev-workflow/` in the git repository
- **Installed location** (runtime): Plugins are installed to `~/.claude/plugins/cache/<publisher>/<plugin>/<version>/` with the same directory structure
- Scripts need to work from either location and locate dependencies correctly

**Solution:** The [`resolve_plugin_root.sh`](./.claude/resolve_plugin_root.sh) script automatically finds the installed plugin location at runtime.

**How it works:**
1. SKILL.md files check for the resolver script in two locations:
   - First checks local project: `./.claude/resolve_plugin_root.sh`
   - Falls back to user home directory: `$HOME/.claude/resolve_plugin_root.sh`
2. The resolver queries `~/.claude/plugins/installed_plugins.json` to find the plugin's installation path
3. Returns the installation path (e.g., `~/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.0.1/`)
4. Scripts use `${CLAUDE_PLUGIN_ROOT}` to reference skill files relative to the installation path
5. Uses `CLAUDE_PLUGIN_ROOT` environment variable if already set (forward compatibility)

**For plugin developers:** The resolver script is located at [`./.claude/resolve_plugin_root.sh`](./.claude/resolve_plugin_root.sh) and handles plugin discovery automatically.

**For plugin users:** The resolver script is copied to your project during plugin installation. No manual setup required—skills automatically locate their dependencies.

**See also:**
- [GitHub Issue #9354: Claude Code Plugin Environment Variable Bug](https://github.com/anthropics/claude-code/issues/9354) - Details about the core issue this resolver works around
- [`plugins/dev-workflow/skills/lib/common.sh`](./plugins/dev-workflow/skills/lib/common.sh) - Shared utility functions used by all skills

## Testing

These plugins leverage bash scripting extensively. Scripts are infamously fragile and hard to maintain, which is why we have a test suite:

```bash
./tests/run-all-tests.sh
```

Tests use [shUnit2](https://github.com/kward/shunit2) framework with mocked external commands. See `tests/README.md` for detailed testing documentation.

## Author

[@noahlz](https://github.com/noahlz)

## License

[MIT License (MIT)](./LICENSE)
