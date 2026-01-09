# Claude Plugins Test Suite

Comprehensive test coverage for claude-plugins skills and scripts.

## Overview

Tests are written using Node.js built-in `node:test` module with **dependency injection** for mocking. The test suite validates that scripts and JS modules work correctly with fixture data and injected dependencies (no external mocking libraries or experimental features).

## Running Tests

**Run all tests**

```bash
npm test
```

**Run a single test**

```bash
npm test -- test/path/to/test.js
```

**Run tests matching a pattern**

```bash
npm test -- test/dev-workflow/lib/*.test.js
```

**Run with coverage**

```bash
npm run coverage
```

## Test Infrastructure

### Node.js Test Framework

Tests use Node.js built-in `node:test` module with `node:assert` for assertions:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

describe('my-skill: my-script.js', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  it('does something', () => {
    // Test implementation
    assert.equal(actual, expected);
  });
});
```

### Test Helpers

Common utilities in `lib/helpers.js` support test setup, fixture loading, and script execution. See the file for available functions.

### Dependency Injection for Mocking

Tests use **dependency injection** to provide mock dependencies. Mock objects are passed via a `deps` parameter to functions under test. This avoids external mocking libraries and experimental Node.js features.

Benefits:
- Isolates tests from external dependencies
- Avoids heavy dependencies in test environments
- Provides clean, controllable mock behavior per test

See examples in:
- `test/dev-workflow/write-git-commit/commit-workflow.test.js` - Injecting ccusage and git mocks
- `test/dev-workflow/write-git-commit/git-operations.test.js` - Testing git operations directly

### Fixtures

Pre-built test data in `test/dev-workflow/fixtures/`:

- **`configs/`** - Configuration files for build and commit tests
- **`project-templates/`** - Minimal project structures for tool detection tests

Use `readFixture()` to load fixtures in tests. Modify loaded data inline for variations without creating additional fixture files.

## Writing New Tests

1. Create test file in `test/dev-workflow/{plugin-name}/`
2. Use `describe()` and `it()` from `node:test`
3. Use `setupTestEnv()` in `beforeEach()` to initialize test directories
4. Use `readFixture()` to load pre-built test data from `fixtures/`
5. Modify fixture data inline for test variations without creating additional fixture files

See existing tests in `test/dev-workflow/` for examples.

## Adding New Mock Scripts

To create a new mock command / script:

1. Create executable file in `lib/mocks/`
2. Implement command logic (any language)
3. Return appropriate exit codes and output

Mocks are automatically available on PATH during test execution.
