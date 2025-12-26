# Claude Code Plugins

Productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

## Available Plugins

### Dev Workflow

Efficient workflows for common development tasks.

Add the marketplace to your Claude Code settings:

```bash
claude plugin marketplace add https://github.com/noahlz/claude-plugins.git
claude plugin install dev-workflow@noahlz.github.com
```

#### Skills

| Skill | Description | Command |
|-------|-------------|---------|
| `write-git-commit` | Create git commits with Claude Code cost metrics embedded in commit footers. Requires [`ccusage`](https://github.com/ryoppippi/ccusage). | `/dev-workflow:commit` (or `/commit`) |
| `run-and-fix-tests` | Run tests with clean output and fix any failures using the `test-fixer` agent. | `/dev-workflow:test` (or `/test`) |

#### Agents

`test-fixer` - Analyze failing tests and implement root-cause fixes. Guides compilation error resolution and test failure diagnosis. Invoke when user asks to fix failing tests or when `run-and-fix-tests` skill encounters failing tests. 

## Development

### Local Development Setup

When developing these plugins, you can test them locally using the marketplace path:

```bash
# From the claude-plugins directory, add the local marketplace
claude plugin marketplace add ./
```

### Plugin Reinstallation

When making changes to plugin code, you must fully uninstall and reinstall the plugin for changes to take effect. Run the provided script `./reinstall.sh`

Alternatively, update the plugin version number in `marketplace.json` and then trigger a marketplace/plugin update in Claude Code.


### Plugin Root Resolution

Skills need to locate the plugin installation directory at runtime. The [`resolve_plugin_root.sh`](./.claude/resolve_plugin_root.sh) script handles this automatically by querying `~/.claude/plugins/installed_plugins.json` to find the installation path.

Related: [GitHub Issue #9354: Claude Code Plugin Environment Variable Bug](https://github.com/anthropics/claude-code/issues/9354)

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
