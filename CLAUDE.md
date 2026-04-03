# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins) with standard directory conventions and an extensive test suite.

## Development Rules for Skills, Agents and Hooks

- After creating or updating any agent, skill or reference file: review and revise the changed text to be concise, imperative, and LLM-friendly.
- Write scripts, not ad-hoc Bash commands. Keep shared scripts in `plugins/dev-workflow/lib/`.
- Minimize external dependencies. Use pure Node.js/JavaScript. Do NOT add npm packages without user approval.
- Do NOT preserve backwards compatibility when enhancing or refactoring.
- Write tests for all changes. Run the `dev-workflow:run-tests` skill after every script change. See [test/CLAUDE.md](./test/CLAUDE.md).

## ccusage

Several skills use the tool [`ccusage`](https://github.com/ryoppippi/ccusage) for model usage and cost stats.

## Reinstall After Changes

After modifying scripts, SKILL.md, agents, or references: prompt the user to run `./force-reinstall.sh` and restart Claude Code. `/reload-plugins` only works for remote registry plugins, not local development.
