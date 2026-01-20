# Testing Methodology

## Core Principles

- Use built-in `node:test` module with `node:assert` - no external mocking libraries
- Use dependency injection, mock/stub external dependencies and data
- Fast: target: less than 5 seconds to run all tests

## Test Organization

### Directory Structure

```
test/
├── lib/                        # Shared test utilities
├── dev-workflow/
│   ├── run-and-fix-tests/
│   │   ├── CLAUDE.md           # Suite-specific instructions
│   │   └── fixtures/
│   │       ├── configs/            # Configuration fixtures
│   │       └── project-templates/  # Project structure fixtures
│   └── write-git-commit/
│       └── CLAUDE.md           # Suite-specific instructions
```

### Test Types

- **Unit tests** (`*.unit.test.js`): Mock all dependencies, test logic in isolation
- **Integration tests** (`*.integration.test.js`): Real dependenies: git repos, subprocess execution 

## Writing Tests

### Standard Structure

See [`commit-workflow.unit.test.js`](./dev-workflow/write-git-commit/commit-workflow.unit.test.js) for the standard pattern:
- Import `describe`, `it`, `beforeEach`, `afterEach` from `node:test`
- Import `assert` from `node:assert`
- Use `setupTestEnv()` / `teardownTestEnv()` lifecycle
- Create mock dependencies in `beforeEach()`
- Pass mocks via `deps` parameter to functions under test

### Dependency Injection Pattern

**Key concept:** Pass all external dependencies via a `deps` parameter.

**Example implementation:** See [`commit-workflow.js`](../plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js) for examples of how functions accept `deps`.

**Example usage in tests:** See [`commit-workflow.unit.test.js`](./dev-workflow/write-git-commit/commit-workflow.unit.test.js) for examples of passing `{ deps: { ccusage: testCcusage } }`.

### Mock Creation Pattern

**Key concept:** Mock factories with throwing defaults prevent silent test failures.

**Example implementation:** See functions in [`write-git-commit/helpers.js`](./dev-workflow/write-git-commit/helpers.js):
- `createMockCcusage()`
- `createMockGit()`
- `createMockLoadSessionData()`

**How it works:**
1. Base mock throws errors on all methods
2. Tests override only methods they need
3. Unexpected calls fail immediately with clear error

**Example usage:** See [`commit-workflow.unit.test.js`](./dev-workflow/write-git-commit/commit-workflow.unit.test.js) for examples of selective overrides.

### Assertion Helpers

Create custom helpers to encapsulate complex assertions and reduce test duplication.

**Examples:**
- [`run-and-fix-tests/helpers.js`](./dev-workflow/run-and-fix-tests/helpers.js) functions: `assertParserResult()`, `assertErrorDetails()`, `assertFailureDetails()`
- [`write-git-commit/helpers.js`](./dev-workflow/write-git-commit/helpers.js) functions: `assertResultStatus()`, `assertCommitMessage()`

### Wrapper Functions

Reduce boilerplate by wrapping common test setup patterns.

**Examples:**
- [`run-and-fix-tests/helpers.js`](./dev-workflow/run-and-fix-tests/helpers.js) functions: `parseBuildWithMock()`, `parseTestsWithMock()`, `parseTestsWithGlob()`
- [`write-git-commit/helpers.js`](./dev-workflow/write-git-commit/helpers.js) functions: `execCommitWorkflow()`

## Test Environment Lifecycle

### Setup and Teardown

- `setupTestEnv()` - Creates isolated temporary directory
- `teardownTestEnv()` - Removes temp directory recursively
- Always use in `beforeEach()` / `afterEach()`

**Example:** See any test file's structure, e.g. [`parse-build-errors.test.js`](./dev-workflow/run-and-fix-tests/parse-build-errors.test.js)

## Troubleshooting

### Hanging Tests

**Problem:** Tests hang indefinitely instead of completing in < 5 seconds.

**Root cause:** Functions with stdin fallback block when empty string triggers fallback. Empty string (`''`) is falsy, so `if (providedMessage)` incorrectly treats it as missing.

**Fix:** Use explicit nullish checks: `if (providedMessage !== null && providedMessage !== undefined)`

### Test Failures

If tests fail:
1. Look for TAP report format showing failed tests
2. Check assertion messages for context

### Mock Not Being Called

Throwing default pattern catches this automatically - test fails immediately with clear error message.

To verify a method should NOT be called, keep the throwing default (don't override it).
