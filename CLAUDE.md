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

## Testing Approach

### Use Dependency Injection and Lightweight Mocking

**Use Dependency Injection for all mocking. Do NOT use external mocking libraries or the experimental Node.js mocking module.**

Inject dependencies as a `deps` parameter in function options:
- Pass `deps: { git: mockGit, ccusage: mockCcusage }` to functions in tests
- For each test, create new base mocks that selectively override functions under test and throw errors for unexpected calls
- Example: `await prepare({ baseDir: '.', deps: { ccusage: testCcusage } })`

**Test Helper Pattern:**
- Create reusable mock factories in `test/dev-workflow/<skill>/helpers.js`
- Export functions like `createMockX(data)` that return mock implementations
- Keep helpers simple: return async functions or objects with predictable behavior
- Example: `createMockLoadSessionData(sessions)` returns `async () => sessions`

See the [testing README.md](./test/README.md) for additional context on writing tests effectively.

### Running Tests: Silence is Golden

Use the `dev-workflow:run-and-fix-tests` skill to test changes to this project.

Example test command, which you should derive from the build configuration `.claude/settings.plugins.run-and-fix-tests.json`:

```bash
npm --silent test && echo "✓ Tests Passed!" || echo "✗ Tests FAILED"  
```

**NOTE: Do NOT use `tee`.** You'll obtain context for test failures from build and tests log files, if needed.

If the tests fail (non-zero exit code) read the test results (tap report format) under `dist/`

### Troubleshooting Tests

#### Hanging Tests: stdin/Stream Fallback

**Problem:** Tests for the plugins should complete in *under 5 seconds*, but sometimes (due to a bug) tests hang indefinitely.

**Root cause:** Functions that depend on reading from `stdin` may hang. If a function that is hanging accepts a `message` parameter falls back stdin, it will block waiting for input. Empty string (`''`) is falsy and triggers the fallback.

**Fix in code:** Use explicit nullish checks, not truthiness checks:
```javascript
// WRONG - empty string triggers stdin fallback
if (providedMessage) { inputStream = ... }

// CORRECT - distinguishes between null/undefined vs empty string
if (providedMessage !== null && providedMessage !== undefined) { inputStream = ... }
```

**Fix in tests:** Always provide complete mock input or proper null checks in code.
