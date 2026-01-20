# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins).

## Project Structure

```
claude-plugins/
├── .claude-plugin/
├── plugins/
│   └── dev-workflow/
│       ├── agents/
│       ├── commands/
│       ├── lib/       # Shared scripts
│       └── skills/
│           ├── run-and-fix-tests/
│           │   ├── assets/
│           │   │   └── defaults/     # Default configs for build tools
│           │   ├── references/
│           │   └── scripts/
│           └── write-git-commit/
│               ├── references/
│               └── scripts/
└── test/
    ├── dev-workflow/
    │   ├── fixtures/
    │   │   ├── configs/
    │   │   └── project-templates/
    │   ├── run-and-fix-tests/
    │   └── write-git-commit/
    └── lib/                     # Cross-module test utilities
```

## Development Philosophy

### Use Best Practices

Follow the [best practices guide for skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

### Move Fast and Break Things

**This plugin is not yet released!** You do **NOT** have keep existing behavior for "backwards compatability" when adding enhancements or refactoring.

### Script-First Approach

- Prefer writing and orchestrating pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under `plugins/dev-workflow/lib/` for use by all skills and agents
- Write Node.js tests for scripts, placing them under `test/dev-workflow/` in directories named for the corresponding skills and plugins.

### Dependencies

**Minimize external dependencies. Use pure Node.js and JavaScript.**

Do NOT add additional npm packages without justification and approval by the user.

**Runtime**: `ccusage` (in `plugins/dev-workflow/package.json`)
  - Used by `write-git-commit` skill to fetch and embed cost metrics in git commits

### NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.

Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.

## Testing

### Adding / Updating Tests

If you need to add new or update existing tests, see: [test/CLAUDE.md](./test/CLAUDE.md) 

### Running Tests

**ALWAYS** use the `dev-workflow:run-and-fix-tests` skill to run tests, such as after making changes to Node / JavaScript code. 

