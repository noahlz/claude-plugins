# Claude Code Plugins

Developer workflow, productivity, and writing plugins for Claude Code.

See: [Claude Code: Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

[![Node.js CI](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml/badge.svg)](https://github.com/noahlz/claude-plugins/actions/workflows/node.js.yml)

## Plugins

| Plugin | Description |
|--------|-------------|
| [dev-workflow](#dev-workflow) | Workflows for common development tasks. |
| [writing-tools](#writing-tools) | Writing and editing tools for content creation. |

### Installation (Claude Code)

Add the marketplace once, then install the plugins you want:

```bash
claude plugin marketplace add noahlz/claude-plugins
claude plugin install dev-workflow@noahlz.github.io
claude plugin install writing-tools@noahlz.github.io
```

#### Prerequisites

- Node.js 22+ (required for dev-workflow only)

### Installation (Claude.ai Web)

Several writing-oriented skills are available standalone for use on [claude.ai](https://claude.ai). Accounts must be Pro, Max, Team, or Enterprise plan with code execution enabled.

Available web-packaged skills:

- [`de-llm`](./plugins/writing-tools/skills/de-llm/SKILL.md)
- [`craft-linkedin-post`](./plugins/writing-tools/skills/craft-linkedin-post/SKILL.md) — bundles the `linkedin-reviewer` agent
- [`tighten-for-llms`](./plugins/dev-workflow/skills/tighten-for-llms/SKILL.md)

See [writing-tools](#writing-tools) and [dev-workflow](#dev-workflow) sections below for descriptions.

To install:

1. Download zip from the [latest release](https://github.com/noahlz/claude-plugins/releases/latest) page
2. In Claude.ai, open **Settings → Capabilities** and choose **Upload skill**.
3. Drag the skill ZIP file to **Upload skill**. The skill will now be available in your chats.

## dev-workflow

Workflows for common development tasks.

### Skills

| Skill | Description | Slash Command |
|-------|-------------|---------------|
| [`run-tests`](./plugins/dev-workflow/skills/run-tests/SKILL.md) | Run tests, analyze failures, and propose fixes via sub-agents. | `/run-tests` |
| [`commit-with-costs`](./plugins/dev-workflow/skills/commit-with-costs/SKILL.md) | Create git commits with Claude Code attribution and session cost metrics. | `/commit-with-costs` |
| [`preview-commit-message`](./plugins/dev-workflow/skills/preview-commit-message/SKILL.md) | Draft a commit message from staged changes without committing. | `/preview-commit-message` |
| [`commit-only`](./plugins/dev-workflow/skills/commit-only/SKILL.md) | Commit staged changes with an AI-generated message. No cost metrics. | `/commit-only` |
| [`view-cost-metrics`](./plugins/dev-workflow/skills/view-cost-metrics/SKILL.md) | Display current session cost metrics without creating a commit. | `/view-cost-metrics` |
| [`check-claude-changelog`](./plugins/dev-workflow/skills/check-claude-changelog/SKILL.md) | Check Claude Code changelog for updates since your last commit, with relevance scoring. | `/check-claude-changelog [since <version>]` |
| [`update-changelog`](./plugins/dev-workflow/skills/update-changelog/SKILL.md) | Inspect commits since last release and compose changelog entries matching your project's format. | `/update-changelog` |
| [`tighten-for-llms`](./plugins/dev-workflow/skills/tighten-for-llms/SKILL.md) | Make skill, agent, reference, rule, or doc files more concise and LLM-friendly. | `/tighten-for-llms [file-path \| skill-name \| agent-name \| docs \| readme \| rules]` |
| [`zero-shot`](./plugins/dev-workflow/skills/zero-shot/SKILL.md) | **Experimental.** Aggressively distill LLM-facing prose: skill files → 1–3 imperative sentences, instruction files → imperative bullets per section. | `/zero-shot [apply] [file-path \| skill-name \| agent-name \| rules]` |

### Agents

| Agent | Description |
|-------|-------------|
| [`broken-build-analyzer`](./plugins/dev-workflow/agents/broken-build-analyzer.md) | Analyzes build/compilation failures and provides diagnosis suitable for creating a plan to fix the build. Used by `run-tests`. |
| [`failed-test-analyzer`](./plugins/dev-workflow/agents/failed-test-analyzer.md) | Analyzes test failures and provides diagnosis suitable for creating a plan to fix the tests. Used by `run-tests`. |
| [`react-code-reviewer`](./plugins/dev-workflow/agents/react-code-reviewer.md) | Reviews React/TypeScript code changes for quality, maintainability, and best practices. Reports findings by priority with concrete fixes. |
| [`test-quality-reviewer`](./plugins/dev-workflow/agents/test-quality-reviewer.md) | Reviews written or modified tests for assertion quality, mock validity, and clean test structure. Reports findings by severity. |

## writing-tools

Writing and editing tools for content creation.

### Skills

| Skill | Description | Slash Command |
|-------|-------------|---------------|
| [`craft-linkedin-post`](./plugins/writing-tools/skills/craft-linkedin-post/SKILL.md) | Draft, review, and iterate a LinkedIn post from an outline. Uses the `linkedin-reviewer` agent. | `/craft-linkedin-post` |
| [`de-llm`](./plugins/writing-tools/skills/de-llm/SKILL.md) | Post-process prose to strip AI-telltale patterns: puffery, inline meta-commentary, unsourced evaluative claims. Derived from [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). | `/de-llm [file-path]` |

### Agents

| Agent | Description |
|-------|-------------|
| [`linkedin-reviewer`](./plugins/writing-tools/agents/linkedin-reviewer.md) | Reviews a LinkedIn draft post for hook strength, clarity, mobile structure, authenticity, and engagement potential. |

## Development

### Local Development Setup

When developing these plugins, you can install them from local source:

```bash
claude plugin marketplace add ./
```

### Updating

Claude Code caches installed plugins as full copies in `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. These are regular files, not symlinks — editing your source directory does not change what Claude Code reads.

`/reload-plugins` reloads from this version-keyed cache. If you modify plugin files without bumping the version in `marketplace.json`, `/reload-plugins` will reload the stale cached copy and **not** pick up your source changes.

To pick up source changes without bumping the version, run `./force-reinstall.sh`:

```bash
./force-reinstall.sh
```

This script clears the cache directories, uninstalls, and reinstalls from local source.

Use this when:
- You've modified SKILL.md, scripts, agents, or other plugin files without bumping the version
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
