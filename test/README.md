# Claude Plugins Test Suite

Comprehensive test coverage for all shell scripts in the claude-plugins repository.

## Overview

Tests are written using [shUnit2](https://github.com/kward/shunit2), an xUnit-style testing framework for shell scripts. The test suite validates that scripts work correctly with mocked external dependencies.

## Running Tests

### Run all tests
```bash
npm test
```

## Test Structure

```
test/
├── helpers.js                   # Common test utilities
├── lib/
│   ├── mocks/
│   │   ├── ccusage              # Mock for Claude Code usage CLI
│   │   └── git                  # Mock for git VCS commands
├── fixtures/
│   ├── configs/                 # Sample configuration files
│   ├── cost-arrays/             # Sample cost array data
│   ├── metrics/                 # Sample metrics files
├── dev-workflow/
│   ├── run-and-fix-tests/
│   │   ├── detect-and-resolve.test.js
│   │   ├── load-config.test.js
│   │   └── select-default.test.js
│   └── write-git-commit/
│       ├── claude-session-cost.test.js
│       ├── commit-workflow.test.js
│       └── load-config.test.js
├── run-all-tests.js             # Test runner
└── README.md                    # This file
```

## Test Infrastructure

### shUnit2 Framework

Each test file sources shUnit2 at the end and defines test functions with the `test*` naming convention. For example:

```bash
test_loads_default_config() {
  # Test body
}

# Source shUnit2 at the end
. "$TESTS_ROOT/shunit2"
```

### Test Helpers (test-helpers.sh)

Common utilities for test setup and assertions:

- `setup_test_env()` - Initialize temp directory and PATH
- `teardown_test_env()` - Clean up temp directory
- `assert_json_equals()` - Compare JSON objects (order-independent)
- `assert_json_has_key()` - Check if JSON object has a key
- `assert_matches()` - Check if string matches regex pattern
- `assert_file_exists()` / `assert_file_not_exists()` - File assertions
- `create_fixture()` - Create test fixture files
- `read_fixture()` - Read fixture files
- `export_test_env_vars()` - Set required environment variables

### Mock Scripts

Mock scripts intercept external commands and return predefined responses:

- **ccusage** - Returns mock Claude Code session data
- **git** - Returns mock commit SHAs and status

Mocks are placed in `tests/lib/mocks/` and are prepended to PATH during test execution.

### Fixtures

Pre-built test data in `tests/fixtures/`:

- `configs/` - Sample JSON configuration files
- `cost-arrays/` - Sample cost array data for metrics testing
- `metrics/` - Sample NDJSON metrics files
- `projects/` - Sample project structures with build files

## Writing New Tests

### 1. Create test file in appropriate plugin directory

```bash
# For write-git-commit scripts
touch tests/write-git-commit/test-your-script.sh

# For run-and-fix-tests scripts
touch tests/run-and-fix-tests/test-your-script.sh
```

### 2. Set up test structure

```bash
#!/bin/bash
# Tests for your-script.sh

# Setup runs before each test
setUp() {
  if [ -z "$TESTS_ROOT" ]; then
    TESTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    export TESTS_ROOT
  fi

  . "$TESTS_ROOT/lib/test-helpers.sh"
  setup_test_env

  export CLAUDE_PLUGIN_ROOT="/path/to/plugin"
  cd "$TEST_TMPDIR" || exit 1
}

# Teardown runs after each test
tearDown() {
  teardown_test_env
}

# Test functions with test* prefix
test_something() {
  # Test implementation
}

# Source shUnit2 at the end
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
```

### 3. Use test helpers for assertions

```bash
test_example() {
  # Create temporary config
  create_fixture "test-config.json" '{"key":"value"}'

  # Run your script
  bash "$SCRIPT_PATH"

  # Assert file exists
  assert_file_exists "expected-output.json"

  # Assert JSON structure
  local result=$(cat expected-output.json)
  assert_json_has_key "$result" "key"
}
```

## Mocking Strategy

### Using Mocks

Mocks are automatically available on PATH during tests. The mock scripts intercept external CLI calls:

```bash
test_uses_external_command() {
  # The mock 'git' is called instead of real git
  git rev-parse HEAD

  # Mock returns: abc123def456ghi789jkl012mno345pqr
}
```

### Adding Mocks

To create a new mock:

1. Create file in `tests/lib/mocks/`
2. Implement command logic
3. Make it executable: `chmod +x tests/lib/mocks/your-command`

Mock example:

```bash
#!/bin/bash
# tests/lib/mocks/your-command

if [ "$1" = "some-arg" ]; then
  echo "mock response"
  exit 0
else
  echo "Error: Unsupported argument" >&2
  exit 1
fi
```

## Debugging Tests

### Enable verbose output

Run shUnit2 with debug flags:

```bash
bash -x tests/write-git-commit/test-load-config.sh testLoadsDefaultConfig
```

### Inspect test environment

```bash
test_debug() {
  # Print working directory
  echo "Working directory: $(pwd)"

  # Print environment
  echo "TEST_TMPDIR=$TEST_TMPDIR"

  # List test files
  ls -la "$TEST_TMPDIR"
}
```

### Keep temp directories after test

Modify `tearDown` temporarily to prevent cleanup:

```bash
tearDown() {
  # Temporarily comment out to debug
  # teardown_test_env
  echo "Test directory: $TEST_TMPDIR"
}
```

## Troubleshooting

### "command not found" in tests

Make sure mocks are executable and PATH includes `tests/lib/mocks`:

```bash
chmod +x tests/lib/mocks/*
export PATH="tests/lib/mocks:$PATH"
```

### jq: parse error

Ensure JSON fixtures are properly formatted:

```bash
jq '.' tests/fixtures/configs/*.json
```

### Temp directory not cleaning up

Check that `tearDown` is called and `TEST_TMPDIR` is set:

```bash
# In test
echo "TEST_TMPDIR=$TEST_TMPDIR"

# Manual cleanup
rm -rf "$TEST_TMPDIR"
```
