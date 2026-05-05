# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins) for developer workflow, productivity, and writing — with standard directory conventions and an extensive test suite.

## Development Rules for Skills, Agents and Hooks

- After creating or updating any agent, skill or reference file: use the `dev-workflow:tighten-for-llms` skill to make it concise, imperative, and LLM-friendly.
- Write scripts, not ad-hoc Bash commands. Keep shared scripts in `plugins/dev-workflow/lib/`.
- Minimize external dependencies. Use pure Node.js/JavaScript. Do NOT add npm packages without user approval.
- Do NOT preserve backwards compatibility when enhancing or refactoring.
- Write tests for all changes and then use the `dev-workflow:run-tests` skill to verify your work. See [test/CLAUDE.md](./test/CLAUDE.md).

## ccusage

Be aware: the `dev-workflow` commit skills (`commit-with-costs`, `view-cost-metrics`) use [`ccusage`](https://github.com/ryoppippi/ccusage) to extract Claude Code session cost data for commit trailers.

## Versioning

`release-it` handles version bumps. Do NOT edit version numbers in `marketplace.json`.

## Examples

`examples/<plugin>/<skill>/` contains sample inputs for manual skill testing. When updating a skill, check for fixtures and test with the appropriate invocation (e.g. `/de-llm <file>`).

## Reinstall After Changes

After modifying scripts, SKILL.md, agents, or references: prompt the user to run `./force-reinstall.sh`. Claude Code caches plugins by version — `/reload-plugins` reloads from cache, so source edits without a version bump won't take effect until the cache is cleared.
