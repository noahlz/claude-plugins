# Claude Plugins Test Suite

Comprehensive test coverage for claude-plugins skills and scripts.

## Overview

Tests are written using Node.js built-in `node:test` module. The test suite validates that scripts and JS modules work correctly with fixture data and mocked external dependencies.

## Running Tests

**Run all tests**

```bash
npm test
```

**Run a single test**

```bash
node --test test/path/to/test.js`
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

Common utilities in `helpers.js` support test setup, fixture loading, and script execution. See the file for available functions.

### Mock Scripts

Mock scripts intercept external commands and return predefined responses:

- **ccusage** - Returns mock Claude Code session data
- **git** - Returns mock commit SHAs and status

Mocks are placed in `tests/lib/mocks/` and are prepended to PATH during test execution.

### Fixtures

Pre-built test data in `test/dev-workflow/fixtures/`:

- **`configs/`** - Configuration files for build and commit tests
- **`project-templates/`** - Minimal project structures for tool detection tests
- **`cost-arrays/`** - Sample cost data for metrics testing
- **`metrics/`** - Sample metrics files

Use `readFixture()` to load fixtures in tests. Modify loaded data inline for variations without creating additional fixture files.

## Writing New Tests

1. Create test file in `test/dev-workflow/{plugin-name}/`
2. Use `describe()` and `it()` from `node:test`
3. Use `setupTestEnv()` in `beforeEach()` to initialize test directories
4. Use `readFixture()` to load pre-built test data from `fixtures/`
5. Modify fixture data inline for test variations without creating additional fixture files

See existing tests in `test/dev-workflow/` for examples.

## Adding New Mocks

To create a new mock command:

1. Create executable file in `lib/mocks/`
2. Implement command logic (any language)
3. Return appropriate exit codes and output

Mocks are automatically available on PATH during test execution.
