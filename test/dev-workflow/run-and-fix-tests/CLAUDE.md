# Testing Methodology: run-and-fix-tests

Tips on writing and running tests for the run-and-fix-tests script suite:

## Fixtures

### Loading Fixtures

Use `readFixture(pluginName, fixturePath)` from [`../../lib/helpers.js`](../../lib/helpers.js) to load test data.

### Modifying Fixtures

Prefer inline modification over creating fixture variants.

**Example:** See [`load-config.test.js`](./load-config.test.js) for example of `loadConfigFixture()` with inline modification.

### Project Templates

Use `setupProjectTemplate()` for tests requiring realistic project structures.

**Example:** See [`detect-and-resolve.test.js`](./detect-and-resolve.test.js) for examples of tool detection tests.
