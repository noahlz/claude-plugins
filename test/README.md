# Claude Plugins Test Suite

> **Testing Methodology** See [CLAUDE.md](./CLAUDE.md) for dependency injection patterns, mock creation, assertion helpers, fixture loading, and troubleshooting.

## Running Tests

Use this plugin's own `dev-workflow:run-and-fix-tests` skill to run tests.

To run tests manually:

**All tests:**
```bash
npm test
```

**Single test:**
```bash
npm test -- test/path/to/test.js
```

**Tests matching pattern:**
```bash
npm test -- test/dev-workflow/run-and-fix-tests/*.test.js
```

**With coverage:**
```bash
npm run coverage
```

## Adding a Test

1. Create test file in `test/dev-workflow/{skill-name}/` with pattern `*.test.js`
2. Import from `node:test` and `node:assert`
3. Use `setupTestEnv()` from helpers in `beforeEach()` and `teardownTestEnv()` in `afterEach()`
4. Use existing helpers or add new ones to `helpers.js` for reusable mocks and assertions

See existing tests in [`test/dev-workflow/`](test/dev-workflow/) for examples.

## Test Infrastructure

Common utilities in [`lib/helpers.js`](./lib/helpers.js) provide:
- `setupTestEnv()` / `teardownTestEnv()` - Test directory lifecycle
- `readFixture()` - Load pre-built test data
- `setupGitRepo()`, `stageFile()`, `execGit()` - Git test helpers
- Helper re-export shortcuts for convenience

Skill-specific helpers in `{skill}/helpers.js` provide:
- Mock factories (`createMockX()`)
- Assertion helpers
- Test setup wrappers

## Fixtures

Some tests use fixtures (template/example files). 

See `test/dev-workflow/run-and-fix-tests/fixtures/`:
- `configs/` - Configuration files for build and commit tests
- `project-templates/` - Minimal project structures for tool detection tests

Load with `readFixture()` and modify inline rather than creating fixture variants.
