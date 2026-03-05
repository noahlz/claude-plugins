# Claude Code Plugins

Productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

[![Node.js CI](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml/badge.svg)](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml)

## Available Plugins

### dev-workflow

AI-assisted workflows for common development tasks.

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

- Node.js 22+

#### Skills

| Skill | Description | Slash Command | Documentation |
|-------|-------------|---------------|---------------|
| [`run-and-fix-tests`](./plugins/dev-workflow/skills/run-and-fix-tests/SKILL.md) | Run tests with clean output and steps through fixing failures, using a plan created by a sub-agent if necessary. | `/run-and-fix-tests` | [README.md](./plugins/dev-workflow/skills/run-and-fix-tests/README.md) |
| [`write-git-commit`](./plugins/dev-workflow/skills/write-git-commit/SKILL.md) | Create git commits with Claude Code cost metrics embedded in commit footers. | `/write-git-commit` | [README.md](./plugins/dev-workflow/skills/write-git-commit/README.md) |

#### Agents

Because reading build and test failures quickly use up context, the `run-and-fix-tests` skill delegates failure analysis to specialized agents:

| Agent | Description |
|-------|-------------|
| [`broken-build-analyzer`](./plugins/dev-workflow/agents/broken-build-analyzer.md) | Analyzes build/compilation failures and provides diagnosis suitable for creating a plan to fix the build. |
| [`failed-test-analyzer`](./plugins/dev-workflow/agents/failed-test-analyzer.md) | Analyzes test failures and provides diagnosis suitable for creating a plan to fix the tests. |

## Development

### Local Development Setup

When developing these plugins, you can install them from local source:

```bash
claude plugin marketplace add ./
```

### Updating

After making changes, you must fully uninstall and reinstall the plugin. 

Run the provided script `./reinstall.sh`. 

Alternatively, update the plugin version number in `marketplace.json` and then trigger a marketplace/plugin update in Claude Code.


### Plugin Root Resolution

Skills use the `${CLAUDE_SKILL_DIR}` environment variable (introduced in Claude Code 2.1.69)
to locate their packaged scripts. Claude Code substitutes this variable in SKILL.md content
at load time with the skill's installed directory path.

**Minimum required version: Claude Code 2.1.69**

Skills will halt and display an error if run on an older version.

## Testing

Scripts used by skills are tested using Node.js with the native `node:test` module.

Run tests with this plugin's `dev-workflow:run-and-fix-tests` skill ("eat your own dogfood") or:

```bash
npm test
```

See [test/CLAUDE.md](./test/CLAUDE.md) for testing methodology, patterns, and examples.

## Authors

[@noahlz](https://github.com/noahlz)  
[Claude](https://claude.com/product/claude-code)

## License

[MIT License (MIT)](./LICENSE)
