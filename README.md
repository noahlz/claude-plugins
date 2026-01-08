# Claude Code Plugins

Productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

[![Node.js CI](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml/badge.svg)](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml)

## Available Plugins

### Dev Workflow

Efficient workflows for common development tasks.

**Quick Install:**

```bash
curl -fsSL https://raw.githubusercontent.com/noahlz/claude-plugins/refs/heads/main/plugins/dev-workflow/install.sh | sh
```

Or manually add the marketplace to your Claude Code settings:

```bash
claude plugin marketplace add noahlz/claude-plugins
claude plugin install dev-workflow@noahlz.github.io
```

#### Prerequisites

- Node.js 22+ (checked by install script)


#### Skills

| Skill | Description | Command | Documentation |
|-------|-------------|---------|---------------|
| [`run-and-fix-tests`](./plugins/dev-workflow/skills/run-and-fix-tests/SKILL.md) | Run tests with clean output and fix any failures using the `test-fixer` agent. | `/dev-workflow:test` (or `/test`) | [README.md](./plugins/dev-workflow/skills/run-and-fix-tests/README.md) |
| [`write-git-commit`](./plugins/dev-workflow/skills/write-git-commit/SKILL.md) | Create git commits with Claude Code cost metrics embedded in commit footers. Runs in sub-agent via `context: fork` | `/dev-workflow:commit` (or `/commit`) | [README.md](./plugins/dev-workflow/skills/write-git-commit/README.md) |

**Note on v2.1.0+:** While Claude Code v2.1.0 [introduced](https://github.com/anthropics/claude-code/commit/870624fc1581a70590e382f263e2972b3f1e56f5) automatic slash command exposure for local skills (`~/.claude/skills`), plugin-installed skills require custom command definitions in the `/commands/` directory to appear in the slash menu. This is a known limitation of the plugin architecture.

#### Agents

| Agent | Description | Invoked By |
|-------|-------------|-----------|
| [`build-fixer`](./plugins/dev-workflow/agents/build-fixer.md) | Analyzes build/compilation failures and implements root-cause fixes. Handles iterative fix-verify loop for compilation errors. | `run-and-fix-tests` skill | 
| [`test-fixer`](./plugins/dev-workflow/agents/test-fixer.md) | Analyzes failing tests and implements root-cause fixes. Guides test failure diagnosis with iterative fix-verify loop. | `run-and-fix-tests` skill |

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

Skills need to locate their install directory at runtime Fortunately, when a skill activates, Claude receives the skill source location as a message like:

```
Base directory for this skill: /User/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit
```

As the skills in this plugin use scripts heavily, they rely heavily on this behavior to locate the scripts accurate. If Anthropic changes this behavior, the skills could break.

Related: [GitHub Issue #9354: Claude Code Plugin Environment Variable Bug](https://github.com/anthropics/claude-code/issues/9354)

## Testing

Scripts used by skills are tested using Node.js with the native `node:test` module.

Run tests with this plugin's `run-and-fix-tests` skill ("eat your own dogfood") or:

```bash
npm test
```

See `test/README.md` for detailed testing documentation.

## Author

[@noahlz](https://github.com/noahlz)

## License

[MIT License (MIT)](./LICENSE)
