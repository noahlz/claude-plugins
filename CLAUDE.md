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

**This plugin is not yet released!** You do **NOT* have keep existing behavior for "backwards compatability" when adding enhancements or refactoring.

### Script-First Approach

- Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under `plugins/dev-workflow/lib/` for use by all skills and agents
- Skills and agents should orchestrate existing scripts, not generate or run improvised logic.
- Write Node.js tests for scripts, placing them under `test/dev-workflow/` in directories named for the corresponding skills and plugins.

**IMPORTANT** Remember that environment variables (i.e. set via `export KEY=VALUE`) do not persist between Bash tool invocations. Therefore, Scripts or Bash commands that call scripts **MUST** output values to the console (stdout) i.e. `echo KEY=VALUE` for the skill to use later.

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

### Dependencies

**Minimize external dependencies. Use pure Node.js and JavaScript only.**

**Runtime**: `ccusage` (in `plugins/dev-workflow/package.json`)
  - Used by `write-git-commit` skill to fetch and embed cost metrics in git commits

Do NOT add additional npm packages without justification and approval by the user.

### NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.

Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.

## Testing Approach

### Use Dependency Injection and Lightweight Mocking

**Use Dependency Injection for all mocking. Do NOT use external mocking libraries or experimental Node.js features.**

Inject dependencies as a `deps` parameter in function options:
- Pass `deps: { git: mockGit, ccusage: mockCcusage }` to functions in tests
- Create base mocks that throw errors for unexpected calls
- Spread and override base mocks per test for fresh isolation
- Example: `await prepare({ baseDir: '.', deps: { ccusage: testCcusage } })`

### Running Tests: Silence is Golden

Use the `dev-workflow:run-and-fix-tests` skill to test changes to this project.

Example test command, which you should derive from the build configuration `.claude/settings.plugins.run-and-fix-tests.json`:

```bash
npm test && echo "✓ Tests Passed!" || echo "✗ Tests FAILED!"  
```

**NOTE: Do NOT use `tee`.** You'll obtain context for test failures from build and tests log files, if needed.

If the tests fail (non-zero exit code) read the test results (tap report format) under `dist/`

### Troubleshooting Tests

#### Hanging Tests: stdin/Stream Fallback

**Problem:** Tests hang indefinitely.

**Root cause:** Functions that depend on reading from `stdin` may hang. If a function that is hanging accepts a `message` parameter falls back stdin, it will block waiting for input. Empty string (`''`) is falsy and triggers the fallback.

**Fix in code:** Use explicit nullish checks, not truthiness checks:
```javascript
// WRONG - empty string triggers stdin fallback
if (providedMessage) { inputStream = ... }

// CORRECT - distinguishes between null/undefined vs empty string
if (providedMessage !== null && providedMessage !== undefined) { inputStream = ... }
```

**Fix in tests:** Always provide complete mock input or proper null checks in code.
