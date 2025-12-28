# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins).

## Project Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json        # Plugin marketplace definition
├── plugins/
│   └── dev-workflow/           # Plugin source code
│       ├── agents/
│       ├── commands/
│       └── skills/
│           ├── lib/            # Shared utilities for all skill scripts
│           ├── run-and-fix-tests/
│           │   ├── defaults/   # Default configurations for various languages / build systems.
│           │   └── scripts/
│           └── write-git-commit/
│               └── scripts/
└── tests/                      # Test suites for scripts used by plugins
```

## Development Philosophy

**Script-First Approach**:
- Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under a sibling `lib/` directory i.e. `plugins/dev-workflow/skills/lib`
- Skills and agents should orchestrate existing scripts, not generate or run improvised logic.
- Write Node.js tests for scripts, placing them under `tests/dev-workflow/` in directories named for the corresponding skills and plugins.
- This keeps workflows testable, maintainable, and predictable.

**Testing Approach**:
- Tests are written in Node.js using the built-in `node:test` module
- Tests validate actual script behavior: JSON output validation, error handling, edge cases
- Run all tests with: `npm test`

**Agent-Based Error Fixing**:
- Use agents (in `plugins/dev-workflow/agents/`) to handle iterative fix-verify loops: build-fixer for compilation errors, test-fixer for test failures
- Agents receive error lists and environment context from skills via natural language descriptions
- Agents implement the TodoWrite pattern for progress tracking and user control (retry loops, skip/continue prompts)

## NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.

Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.

---

## APPENDIX: Important References

- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)

## APPENDIX: Adding a New Plugin

Place new plugins under the `plugins/` directory:

```bash
plugins/
├── dev-workflow/          # Existing plugin
└── my-plugin/             # New plugin
    ├── agents/
    ├── commands/
    └── skills/
```

Also:
- Examine the existing plugins for conventions and structure.
- Add the plugin registration to `.claude-code/markeplace.json`.
