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
- `jq`

#### Skills

| Skill | Description | Command | Documentation |
|-------|-------------|---------|---------------|
| [`run-and-fix-tests`](./plugins/dev-workflow/skills/run-and-fix-tests/SKILL.md) | Run tests with clean output and steps through fixing failures, using a plan created by a sub-agent if necessary. | `/dev-workflow:test` (or `/test`) | [README.md](./plugins/dev-workflow/skills/run-and-fix-tests/README.md) |
| [`write-git-commit`](./plugins/dev-workflow/skills/write-git-commit/SKILL.md) | Create git commits with Claude Code cost metrics embedded in commit footers. | `/dev-workflow:commit` (or `/commit`) | [README.md](./plugins/dev-workflow/skills/write-git-commit/README.md) |

**Note on v2.1.0+:** While Claude Code v2.1.0 [introduced](https://github.com/anthropics/claude-code/commit/870624fc1581a70590e382f263e2972b3f1e56f5) automatic slash command exposure for local skills (`~/.claude/skills`), plugin-installed skills require custom command definitions in the `/commands/` directory to appear in the slash menu. This is a known limitation of the plugin architecture.

#### Agents

Because reading build and test failures quickly use up context, the `run-and-fix-tests` skill delegates failure analysis to specialized agents:

| Agent | Description |
|-------|-------------|
| [`broken-build-analyzer`](./plugins/dev-workflow/agents/broken-build-analyzer.md) | Analyzes build/compilation failures and provides diagnosis suitable for creating a plan to fix the build. | `run-and-fix-tests` skill | 
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

In order to run packaged scripts, skills need to know their install directory. Fortunately, when a skill activates, Claude receives the skill source location as a message like the following:

```
Base directory for this skill: /User/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit
```

The skills in this plugin rely on this message to locate scripts. Of course, things will break if Anthropic changes this behavior.

Related: [GitHub Issue #9354: Claude Code Plugin Environment Variable Bug](https://github.com/anthropics/claude-code/issues/9354)

## Testing

Scripts used by skills are tested using Node.js with the native `node:test` module.

Run tests with this plugin's `dev-workflow:run-and-fix-tests` skill ("eat your own dogfood") or:

```bash
npm test
```

See the [test/README.md](./test/README.md) for detailed testing documentation.

## Author

[@noahlz](https://github.com/noahlz)

## License

[MIT License (MIT)](./LICENSE)
