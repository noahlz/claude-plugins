# Claude Code Plugins

Developer workflow and productivity plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

[![Node.js CI](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml/badge.svg)](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml)

## Available Plugins

### dev-workflow

AI-assisted workflows for common development tasks.

**Install:**

```bash
claude plugin marketplace add noahlz/claude-plugins
claude plugin install dev-workflow@noahlz.github.io
```

#### Prerequisites

- Node.js 22+

#### Skills

| Skill | Description | Slash Command | Documentation |
|-------|-------------|---------------|---------------|
| [`run-tests`](./plugins/dev-workflow/skills/run-tests/SKILL.md) | Run tests, analyze failures, and propose fixes via sub-agents. Infers test commands from project files without requiring configuration. | `/run-tests` | [README.md](./plugins/dev-workflow/skills/run-tests/README.md) |
| [`commit-with-costs`](./plugins/dev-workflow/skills/commit-with-costs/SKILL.md) | Create git commits with Claude Code attribution and session cost metrics embedded in commit footers. | `/commit-with-costs` | [README.md](./plugins/dev-workflow/skills/commit-with-costs/README.md) |
| [`draft-commit-message`](./plugins/dev-workflow/skills/draft-commit-message/SKILL.md) | Draft a commit message from staged changes without committing. | `/draft-commit-message` | [README.md](./plugins/dev-workflow/skills/draft-commit-message/README.md) |
| [`view-cost-metrics`](./plugins/dev-workflow/skills/view-cost-metrics/SKILL.md) | Display current session cost metrics without creating a commit. | `/view-cost-metrics` | [README.md](./plugins/dev-workflow/skills/view-cost-metrics/README.md) |
| [`check-claude-changelog`](./plugins/dev-workflow/skills/check-changelog/SKILL.md) | Check Claude Code changelog for updates since your last commit, with relevance scoring for your project. Requires `gh` CLI. | `/check-claude-changelog` | [README.md](./plugins/dev-workflow/skills/check-changelog/README.md) |

#### Agents

| Agent | Description |
|-------|-------------|
| [`broken-build-analyzer`](./plugins/dev-workflow/agents/broken-build-analyzer.md) | Analyzes build/compilation failures and provides diagnosis suitable for creating a plan to fix the build. Used by `run-tests`. |
| [`failed-test-analyzer`](./plugins/dev-workflow/agents/failed-test-analyzer.md) | Analyzes test failures and provides diagnosis suitable for creating a plan to fix the tests. Used by `run-tests`. |
| [`react-code-reviewer`](./plugins/dev-workflow/agents/react-code-reviewer.md) | Reviews React/TypeScript code changes for quality, maintainability, and best practices. Reports findings by priority with concrete fixes. |
| [`test-quality-reviewer`](./plugins/dev-workflow/agents/test-quality-reviewer.md) | Reviews written or modified tests for assertion quality, mock validity, and clean test structure. Reports findings by severity. |

## Development

### Local Development Setup

When developing these plugins, you can install them from local source:

```bash
claude plugin marketplace add ./
```

### Updating

After making changes, run `/reload-plugins` in Claude Code to pick up the changes without restarting.

### Force Reinstall (Development)

Claude Code caches plugins by version number. If you modify plugin files without bumping the version in `marketplace.json`, `/reload-plugins` will reload from the stale cache and **not** pick up your changes.

Solution: run `./force-reinstall.sh` to bypass the version cache and force a full reinstall from source:

```bash
./force-reinstall.sh
```

Use this when:
- You've modified SKILL.md, scripts, agents, or other plugin files
- `/reload-plugins` is not reflecting your changes


### Plugin Root Resolution

Skills use the `${CLAUDE_SKILL_DIR}` environment variable (introduced in Claude Code 2.1.69) to locate their packaged scripts. Claude Code substitutes this variable in SKILL.md content at load time with the skill's installed directory path.

**Minimum required version: Claude Code 2.1.69**

Skills will halt and display an error if run on an older version.

## Testing

Scripts used by skills are tested using Node.js with the native `node:test` module.

Run tests with this plugin's `dev-workflow:run-tests` skill ("eat your own dogfood") or:

```bash
npm test
```

See [test/CLAUDE.md](./test/CLAUDE.md) for testing methodology, patterns, and examples.

## Authors

[@noahlz](https://github.com/noahlz)  
[Claude](https://claude.com/product/claude-code)

## License

[MIT License (MIT)](./LICENSE)
