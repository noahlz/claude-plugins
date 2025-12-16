# Claude Code Plugins

Productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

## Available Plugins

### write-git-commit
Create git commits with Claude Code cost metrics embedded in commit footers.

**Command:** `/commit`

### run-and-fix-tests
Run tests with clean output and fix any failures.

**Command:** `/test`

## Installation

Add the marketplace to your Claude Code settings:

```bash
claude plugin marketplace add /path/to/claude-plugins
```

## Development

### Local Development Setup

When developing these plugins, you can test them locally using the marketplace path:

```bash
# From the claude-plugins directory, add the local marketplace
claude plugin marketplace add .
```

### Plugin Reinstallation

When making changes to plugin code, you must fully uninstall and reinstall the plugin for changes to take effect:

```bash
# Uninstall the plugin
claude plugin uninstall <plugin-name>

# Reinstall from the marketplace
claude plugin install <plugin-name>
```

**Alternative:** Increment the version number in the plugin's `plugin.json` file to avoid reinstalling:

```json
{
  "name": "write-git-commit",
  "version": "1.0.1",
  ...
}
```

This allows Claude Code to recognize the plugin as updated and load the new version without requiring uninstall/reinstall.

## Testing

Run the test suite to validate all plugin functionality:

```bash
./tests/run-all-tests.sh
```

Tests use [shUnit2](https://github.com/kward/shunit2) framework with mocked external commands. See `tests/README.md` for detailed testing documentation.

## Author

[@noahlz](https://github.com/noahlz)

## License

[MIT License (MIT)](./LICENSE)
