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

### test-runner-fixer (Agent)
Analyze failing tests and implement root-cause fixes. Guides compilation error resolution and test failure diagnosis.

**Invocation:** Use when user asks to run/fix tests or when new/changed code needs validaiton. Uses the `run-and-fix-tests` skill. 

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

## Testing

These plugins leverage bash scripting extenstively. Scripts are infamously fragile and hard to maintain, which is why we have test suite:

```bash
./tests/run-all-tests.sh
```

Tests use [shUnit2](https://github.com/kward/shunit2) framework with mocked external commands. See `tests/README.md` for detailed testing documentation.

## Author

[@noahlz](https://github.com/noahlz)

## License

[MIT License (MIT)](./LICENSE)
