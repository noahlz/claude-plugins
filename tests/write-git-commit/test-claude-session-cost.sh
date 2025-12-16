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
  export PATH="$TESTS_ROOT/lib/mocks:$PATH"
  "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/claude-session-cost.sh" 2>/dev/null
}

# Test: Returns current session costs as JSON array
test_returns_json_array() {
  local output=$(run_session_cost)

  # Should be valid JSON array
  [ "$(echo "$output" | jq 'type')" = '"array"' ] || fail "Valid JSON array"

  # Should have model data
  [ "$(echo "$output" | jq 'length')" -gt 0 ] || fail "Has at least one model"
}

# Test: Output includes required fields
test_includes_required_fields() {
  local output=$(run_session_cost)

  # Should have model field
  echo "$output" | jq -e '.[0].model' > /dev/null || fail "Has model field"

  # Should have inputTokens field
  echo "$output" | jq -e '.[0].inputTokens' > /dev/null || fail "Has inputTokens field"

  # Should have outputTokens field
  echo "$output" | jq -e '.[0].outputTokens' > /dev/null || fail "Has outputTokens field"

  # Should have cost field
  echo "$output" | jq -e '.[0].cost' > /dev/null || fail "Has cost field"
}

# Test: Does not include cache token fields
test_excludes_cache_tokens() {
  local output=$(run_session_cost)

  local has_cache_creation=$(echo "$output" | jq '.[0] | has("cacheCreationTokens")' 2>/dev/null)
  local has_cache_read=$(echo "$output" | jq '.[0] | has("cacheReadTokens")' 2>/dev/null)

  [ "$has_cache_creation" = "false" ] || fail "No cacheCreationTokens"
  [ "$has_cache_read" = "false" ] || fail "No cacheReadTokens"
}

# Test: Handles multiple models in session
test_handles_multiple_models() {
  local output=$(run_session_cost)
  local model_count=$(echo "$output" | jq 'length' 2>/dev/null)

  # Mock returns 2 models (haiku + opus)
  [ "$model_count" -ge 2 ] || fail "Has multiple models"
}

# Test: Costs are rounded to 2 decimal places
test_costs_rounded_to_two_decimals() {
  local output=$(run_session_cost)
  local cost=$(echo "$output" | jq '.[0].cost' 2>/dev/null)

  # Should be a valid cost format (N.NN or N.N)
  echo "$cost" | grep -E '^[0-9]+\.[0-9]{1,2}$' > /dev/null || fail "Cost is valid decimal"
}

# Test: Respects SESSION_FILTER when set
test_respects_session_filter() {
  export SESSION_FILTER="ligeon"
  local output=$(run_session_cost)

  # Should still return valid data
  [ "$(echo "$output" | jq 'type')" = '"array"' ] && [ "$(echo "$output" | jq 'length')" -gt 0 ] || fail "Has data with filter"
}

# Test: Works with empty SESSION_FILTER (uses first session)
test_works_without_filter() {
  export SESSION_FILTER=""
  local output=$(run_session_cost)

  # Should return valid data
  [ "$(echo "$output" | jq 'type')" = '"array"' ] && [ "$(echo "$output" | jq 'length')" -gt 0 ] || fail "Has data without filter"
}

# Test: Output format matches expected structure
test_output_format() {
  local output=$(run_session_cost)

  # Each model should have exactly 4 fields: model, inputTokens, outputTokens, cost
  local field_count=$(echo "$output" | jq '.[0] | keys | length' 2>/dev/null)
  [ "$field_count" = "4" ] || fail "Exactly 4 fields per model (got $field_count)"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
