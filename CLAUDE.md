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
    │   ├── lib/                 # Test suite library scripts (mocks, helpers, utilities)
    │   │   └── mocks/
    │   ├── run-and-fix-tests/
    │   └── write-git-commit/
    └── lib/                     # Cross-module test utilities
```

## Development Philosophy

### Move Fast and Break Things

*This plugin is in early stages!* You do **NOT* have to worry about backwards compatability when adding enhancements or refactoring.

### Script-First Approach

- Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under `plugins/dev-workflow/lib/` for use by all skills and agents
- Skills and agents should orchestrate existing scripts, not generate or run improvised logic.
- Write Node.js tests for scripts, placing them under `test/dev-workflow/` in directories named for the corresponding skills and plugins.

**IMPORTANT** Remember that environment variables (i.e. set via `export KEY=VALUE`) do not presist between Bash tool invocations. Therefore, Scripts or Bash commands that call scripts **MUST** output values to the console (stdout) i.e. `echo KEY=VALUE` for the skill to use later.

### Skill Script Execution

Skills in this plugin execute scripts located at the plugin level using the skill base directory provided by Claude Code at invocation:

**Base directory extraction:**
- Skills extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" message at startup
- Example: `/Users/username/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit`

**Script execution:**
- Scripts are invoked using: `node "$SKILL_BASE_DIR/scripts/script-name.js"`
- Scripts use relative paths to access shared libraries: `require('../../../lib/common.js')`

**Relative path structure:**
```
From: skills/write-git-commit/scripts/script.js
To:   lib/common.js
Path: ../../../lib/common.js
```

### Testing Approach

Use this project's own  `dev-workflow:run-and-fix-tests` skill for regression testing changes and fixing bugs.

### Dependencies

**Runtime**: `ccusage` (in `plugins/dev-workflow/package.json`)
  - Installed as a regular dependency for the dev-workflow plugin
  - Used by `write-git-commit` skill to fetch and embed cost metrics in git commits

**Testing**: No ccusage dependency
  - Tests use Node's native `t.mock.module()` to mock `ccusage-operations.js`
  - Mock implementation in `test/dev-workflow/lib/mocks/ccusage-operations.js` provides all required functions
  - Documentation: https://ccusage.com/guide/library-usage

## NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.

Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.
