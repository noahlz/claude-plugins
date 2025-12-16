#!/bin/bash
# Tests for skills/write-git-commit/scripts/claude-session-cost.sh

# Setup test environment
setUp() {
  if [ -z "$TESTS_ROOT" ]; then
    TESTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    export TESTS_ROOT
  fi

  . "$TESTS_ROOT/lib/test-helpers.sh"
  setup_test_env

  export CLAUDE_PLUGIN_ROOT="/Users/noahlz/projects/claude-plugins"
  export PATH="$TESTS_ROOT/lib/mocks:$PATH"

  cd "$TEST_TMPDIR" || exit 1
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Helper: Run claude-session-cost.sh and capture output
run_session_cost() {
  export SESSION_FILTER="${SESSION_FILTER:-}"
  "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/claude-session-cost.sh" 2>/dev/null
}

# Test: Returns current session costs as JSON array
test_returns_json_array() {
  local output=$(run_session_cost)

  # Should be valid JSON array
  assertTrue "Valid JSON array" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"

  # Should have model data
  assertTrue "Has at least one model" "echo '$output' | jq -e 'length > 0' > /dev/null"
}

# Test: Output includes required fields
test_includes_required_fields() {
  local output=$(run_session_cost)

  # Should have model field
  assertTrue "Has model field" "echo '$output' | jq -e '.[0].model' > /dev/null"

  # Should have inputTokens field
  assertTrue "Has inputTokens field" "echo '$output' | jq -e '.[0].inputTokens' > /dev/null"

  # Should have outputTokens field
  assertTrue "Has outputTokens field" "echo '$output' | jq -e '.[0].outputTokens' > /dev/null"

  # Should have cost field
  assertTrue "Has cost field" "echo '$output' | jq -e '.[0].cost' > /dev/null"
}

# Test: Does not include cache token fields
test_excludes_cache_tokens() {
  local output=$(run_session_cost)

  local has_cache_creation=$(echo "$output" | jq '.[0] | has("cacheCreationTokens")' 2>/dev/null)
  local has_cache_read=$(echo "$output" | jq '.[0] | has("cacheReadTokens")' 2>/dev/null)

  assertEquals "No cacheCreationTokens" "false" "$has_cache_creation"
  assertEquals "No cacheReadTokens" "false" "$has_cache_read"
}

# Test: Handles multiple models in session
test_handles_multiple_models() {
  local output=$(run_session_cost)
  local model_count=$(echo "$output" | jq 'length' 2>/dev/null)

  # Mock returns 2 models (haiku + opus)
  assertTrue "Has multiple models" "[ $model_count -ge 2 ]"
}

# Test: Costs are rounded to 2 decimal places
test_costs_rounded_to_two_decimals() {
  local output=$(run_session_cost)
  local cost=$(echo "$output" | jq '.[0].cost' 2>/dev/null)

  # Should be a valid cost format (N.NN or N.N)
  assertTrue "Cost is valid decimal" "echo '$cost' | grep -E '^[0-9]+\.[0-9]{1,2}$' > /dev/null"
}

# Test: Respects SESSION_FILTER when set
test_respects_session_filter() {
  export SESSION_FILTER="ligeon"
  local output=$(run_session_cost)

  # Should still return valid data
  assertTrue "Has data with filter" "echo '$output' | jq -e 'type == \"array\" and length > 0' > /dev/null"
}

# Test: Works with empty SESSION_FILTER (uses first session)
test_works_without_filter() {
  export SESSION_FILTER=""
  local output=$(run_session_cost)

  # Should return valid data
  assertTrue "Has data without filter" "echo '$output' | jq -e 'type == \"array\" and length > 0' > /dev/null"
}

# Test: Output format matches expected structure
test_output_format() {
  local output=$(run_session_cost)

  # Each model should have exactly 4 fields: model, inputTokens, outputTokens, cost
  local field_count=$(echo "$output" | jq '.[0] | keys | length' 2>/dev/null)
  assertEquals "Exactly 4 fields per model" "4" "$field_count"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
