# Claude Plugins Test Suite

Comprehensive test coverage for skill node scripts using minimal Node.js, the [built-in](https://nodejs.org/api/test.html) `node:test` module and simple dependency injection for mocking. 

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

**Run with coverage report**

```bash
npm run coverage
```

## Adding a Test

1. Create test file in `test/dev-workflow/{plugin-name}/`
2. Use `describe()` and `it()` from `node:test`
3. Use `setupTestEnv()` in `beforeEach()` to initialize test directories
4. Use `readFixture()` to load pre-built test data from `fixtures/`

See existing tests in [`test/dev-workflow/`](test/dev-workflow/) for examples.

## Test Infrastructure

### Test Helpers

Common utilities in [`lib/helpers.js`](./lib/helpers.js) support test setup, fixture loading, and script execution. See the file for available functions.

### Dependency Injection for Mocking

Tests use **dependency injection** to provide mock dependencies. 

Tests define lightweight, inline mock objects that are passed to functions-under-test via a `deps` parameter

See [commit-workflow.unit.test.js](./dev-workflow/write-git-commit/commit-workflow.unit.test.js) for examples.

### Fixtures

Pre-built test data in `test/dev-workflow/fixtures/`:

- [`configs/`](./dev-workflow/fixtures/configs/) - Configuration files for build and commit tests
- [`project-templates/`](./dev-workflow/fixtures/project-templates/) - Minimal project structures for tool detection tests

Use the helper function `readFixture()` to load fixtures in tests and modify them inline rather than creating additional fixture files.

