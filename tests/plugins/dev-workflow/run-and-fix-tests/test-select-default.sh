#!/bin/bash
# Tests for skills/run-and-fix-tests/scripts/select-default.sh

# Setup test environment
setUp() {
  # Get test root directory before any temp setup
  if [ -z "$TESTS_ROOT" ]; then
    TESTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    export TESTS_ROOT
  fi

  # Setup test environment (creates temp dir)
  . "$TESTS_ROOT/lib/test-helpers.sh"
  setup_test_env

  # Set up plugin root
  export CLAUDE_PLUGIN_ROOT="/Users/noahlz/projects/claude-plugins"

  # Set working directory to test temp dir
  cd "$TEST_TMPDIR" || exit 1

  # Create .claude directory
  mkdir -p .claude
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Helper: Create mock DETECTED_TOOLS for single tool
mock_single_tool() {
  local tool_name="$1"
  export DETECTED_TOOLS="[{\"tool\":\"$tool_name\",\"location\":\"(project root)\",\"config\":{}}]"
}

# Helper: Create mock DETECTED_TOOLS for multiple tools
mock_multi_tools() {
  export DETECTED_TOOLS="[{\"tool\":\"npm\",\"location\":\"(project root)\",\"config\":{}},{\"tool\":\"maven\",\"location\":\"backend\",\"config\":{}}]"
}

# Helper: Source select-default script
select_default() {
  source "${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/select-default.sh"
}

# ========================================
# Tests: Single Tool Detection
# ========================================

test_single_tool_uses_matching_default() {
  mock_single_tool "npm"
  select_default

  assertTrue "Config file created" "[ -f .claude/settings.plugins.run-and-fix-tests.json ]"
  assertTrue "npm default was used" "grep -q '\"command\": \"vite build\"' .claude/settings.plugins.run-and-fix-tests.json"
}

test_single_tool_uses_placeholder_when_no_default() {
  # Create a tool that doesn't have a default
  export DETECTED_TOOLS="[{\"tool\":\"unknown-tool\",\"location\":\"(project root)\",\"config\":{}}]"
  select_default

  assertTrue "Config file created" "[ -f .claude/settings.plugins.run-and-fix-tests.json ]"
  assertTrue "Contains placeholder markers" "grep -q '__PLACEHOLDER_' .claude/settings.plugins.run-and-fix-tests.json"
}

test_single_tool_maven_default() {
  mock_single_tool "maven"
  select_default

  assertTrue "Config file created" "[ -f .claude/settings.plugins.run-and-fix-tests.json ]"
  assertTrue "maven default was used" "grep -q '\"command\": \"mvn clean install' .claude/settings.plugins.run-and-fix-tests.json"
  assertTrue "Has test config" "grep -q 'mvn test' .claude/settings.plugins.run-and-fix-tests.json"
}

test_single_tool_go_default() {
  mock_single_tool "go"
  select_default

  assertTrue "Config file created" "[ -f .claude/settings.plugins.run-and-fix-tests.json ]"
  assertTrue "go default was used" "grep -q '\"command\": \"go build' .claude/settings.plugins.run-and-fix-tests.json"
}

# ========================================
# Tests: Multiple Tool Detection (Polyglot)
# ========================================

test_multiple_tools_generates_polyglot() {
  mock_multi_tools
  select_default

  assertTrue "Config file created" "[ -f .claude/settings.plugins.run-and-fix-tests.json ]"
  assertTrue "Build is array" "grep -q '\"build\": \[' .claude/settings.plugins.run-and-fix-tests.json"
  assertTrue "Contains npm" "grep -q 'vite build' .claude/settings.plugins.run-and-fix-tests.json"
  assertTrue "Contains maven" "grep -q 'mvn clean install' .claude/settings.plugins.run-and-fix-tests.json"
}

test_polyglot_has_working_dirs() {
  mock_multi_tools
  select_default

  local config=$(cat .claude/settings.plugins.run-and-fix-tests.json)
  assertTrue "Config has workingDir" "echo '$config' | grep -q 'workingDir'"
}

test_polyglot_config_valid_json() {
  mock_multi_tools
  select_default

  # Try to parse JSON - will fail if invalid
  jq . .claude/settings.plugins.run-and-fix-tests.json > /dev/null 2>&1
  assertTrue "Generated config is valid JSON" "[ $? -eq 0 ]"
}

# ========================================
# Tests: Config File Preservation
# ========================================

test_does_not_overwrite_existing_config() {
  # Create existing config
  echo '{"logDir":"custom"}' > .claude/settings.plugins.run-and-fix-tests.json

  mock_single_tool "npm"
  select_default

  # Should be unchanged (still has custom logDir)
  assertTrue "Existing config preserved" "grep -q 'custom' .claude/settings.plugins.run-and-fix-tests.json"
}

# ========================================
# Tests: Error Cases
# ========================================

test_empty_detected_tools_errors() {
  export DETECTED_TOOLS="[]"

  # Should exit with error
  set +e
  select_default 2>/dev/null
  local exit_code=$?
  set -e

  assertTrue "Exits with error" "[ $exit_code -ne 0 ]"
}

# Load shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
