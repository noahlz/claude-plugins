#!/bin/bash
# Common test utilities for claude-plugins tests

# Setup test environment with temporary directories
setup_test_env() {
  # Create temp directory for this test
  TEST_TMPDIR=$(mktemp -d)
  export TEST_TMPDIR

  # Create .claude directory for configs and metrics
  mkdir -p "$TEST_TMPDIR/.claude"

  # Set up PATH to find mock commands first
  export PATH="${TESTS_ROOT}/lib/mocks:$PATH"

  # Make mocks executable
  chmod +x "$TESTS_ROOT/lib/mocks"/* 2>/dev/null || true
}

# Cleanup test environment
teardown_test_env() {
  if [ -n "$TEST_TMPDIR" ] && [ -d "$TEST_TMPDIR" ]; then
    # Return to a valid directory before cleanup to avoid getcwd errors
    cd / || cd ~ || true
    rm -rf "$TEST_TMPDIR"
  fi
}

# Assert that two JSON objects are equal (order-independent)
assert_json_equals() {
  local expected="$1"
  local actual="$2"
  local message="${3:-JSON objects not equal}"

  # Normalize JSON by parsing and re-serializing
  local expected_normalized=$(echo "$expected" | jq -S '.' 2>/dev/null)
  local actual_normalized=$(echo "$actual" | jq -S '.' 2>/dev/null)

  if [ "$expected_normalized" != "$actual_normalized" ]; then
    echo "Expected: $expected_normalized"
    echo "Actual:   $actual_normalized"
    fail "$message"
  fi
}

# Assert that a JSON object contains a key
assert_json_has_key() {
  local json="$1"
  local key="$2"
  local message="${3:-JSON missing key: $key}"

  if ! echo "$json" | jq -e "has(\"$key\")" > /dev/null 2>&1; then
    fail "$message"
  fi
}

# Assert that a string matches a regex pattern
assert_matches() {
  local string="$1"
  local pattern="$2"
  local message="${3:-String does not match pattern}"

  if ! echo "$string" | grep -q "$pattern"; then
    echo "String: $string"
    echo "Pattern: $pattern"
    fail "$message"
  fi
}

# Assert file exists
assert_file_exists() {
  local file="$1"
  local message="${2:-File not found: $file}"

  if [ ! -f "$file" ]; then
    fail "$message"
  fi
}

# Assert file does not exist
assert_file_not_exists() {
  local file="$1"
  local message="${2:-File should not exist: $file}"

  if [ -f "$file" ]; then
    fail "$message"
  fi
}

# Assert command exits with specific code
assert_exit_code() {
  local expected_code="$1"
  local message="${2:-Exit code not as expected}"

  if [ "$?" -ne "$expected_code" ]; then
    fail "$message (expected $expected_code, got $?)"
  fi
}

# Create a fixture file
create_fixture() {
  local fixture_name="$1"
  local content="$2"
  local output_path="${3:-$TEST_TMPDIR/$fixture_name}"

  mkdir -p "$(dirname "$output_path")"
  echo "$content" > "$output_path"
  echo "$output_path"
}

# Create a fixture from template
create_fixture_from_template() {
  local template_name="$1"
  local output_path="${2:-$TEST_TMPDIR/$template_name}"
  local template_file="$TESTS_ROOT/fixtures/$template_name"

  if [ ! -f "$template_file" ]; then
    fail "Fixture template not found: $template_file"
  fi

  mkdir -p "$(dirname "$output_path")"
  cp "$template_file" "$output_path"
  echo "$output_path"
}

# Get fixture path (for reading fixtures)
get_fixture_path() {
  local fixture_name="$1"
  echo "$TESTS_ROOT/fixtures/$fixture_name"
}

# Read fixture file
read_fixture() {
  local fixture_name="$1"
  local fixture_path="$TESTS_ROOT/fixtures/$fixture_name"

  if [ ! -f "$fixture_path" ]; then
    fail "Fixture not found: $fixture_path"
  fi

  cat "$fixture_path"
}

# Set environment variables for script testing
export_test_env_vars() {
  export CLAUDE_PLUGIN_ROOT="/Users/noahlz/projects/claude-plugins/plugins/write-git-commit"
  export HOME="$TEST_TMPDIR"
}

# Source a script from the plugins directory
source_plugin_script() {
  local plugin="$1"
  local script="$2"
  local script_path="/Users/noahlz/projects/claude-plugins/plugins/$plugin/scripts/$script"

  if [ ! -f "$script_path" ]; then
    fail "Script not found: $script_path"
  fi

  # Source the script
  . "$script_path"
}
