# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins) with standard directory conventions and an extensive test suite.

## Development Rules

- Follow the [best practices guide for skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
- Do NOT preserve backwards compatibility when enhancing or refactoring.
- Write scripts, not ad-hoc Bash commands. Keep shared scripts in `plugins/dev-workflow/lib/`.
- Minimize external dependencies. Use pure Node.js/JavaScript. Do NOT add npm packages without user approval.
- Write tests for all changes. Run the `dev-workflow:run-tests` skill after every script change. See [test/CLAUDE.md](./test/CLAUDE.md).

## ccusage

This project uses [`ccusage`](https://github.com/ryoppippi/ccusage) for Claude Code usage and cost stats.

## Reinstall After Changes

After modifying scripts, SKILL.md, agents, or references: prompt the user to run `./force-reinstall.sh` and restart Claude Code. `/reload-plugins` only works for remote registry plugins, not local development.
