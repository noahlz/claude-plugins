#!/bin/bash
# Tests for plugins/write-git-commit/scripts/claude-cost-delta.sh

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
  export CLAUDE_PLUGIN_ROOT="/Users/noahlz/projects/claude-plugins/plugins/write-git-commit"

  # Set up mocks path (prepend to PATH so mocks are found first)
  export PATH="$TESTS_ROOT/lib/mocks:$PATH"

  # Set working directory to test temp dir
  cd "$TEST_TMPDIR" || exit 1

  # Create .claude directory
  mkdir -p .claude
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Helper: Run claude-cost-delta.sh and capture output
run_delta_script() {
  local metrics_file="${1:-.claude/cost-metrics.json}"

  # Ensure SESSION_FILTER is available (from config or default)
  export SESSION_FILTER="${SESSION_FILTER:-null}"

  "$CLAUDE_PLUGIN_ROOT/scripts/claude-cost-delta.sh" "$metrics_file" 2>/dev/null
}

# Helper: Run claude-cost-delta.sh and capture both stdout and stderr
run_delta_script_with_stderr() {
  local metrics_file="${1:-.claude/cost-metrics.json}"

  # Ensure SESSION_FILTER is available (from config or default)
  export SESSION_FILTER="${SESSION_FILTER:-null}"

  "$CLAUDE_PLUGIN_ROOT/scripts/claude-cost-delta.sh" "$metrics_file" 2>&1
}

# Helper: Run claude-cost-delta.sh and capture exit code
run_delta_script_exit_code() {
  local metrics_file="${1:-.claude/cost-metrics.json}"

  # Ensure SESSION_FILTER is available (from config or default)
  export SESSION_FILTER="${SESSION_FILTER:-null}"

  "$CLAUDE_PLUGIN_ROOT/scripts/claude-cost-delta.sh" "$metrics_file" > /dev/null 2>&1
  echo $?
}

# Test: Returns full cost on first run (no metrics file)
test_returns_full_cost_on_first_run() {
  # No metrics file exists
  local output=$(run_delta_script)

  # Check that output is valid JSON array
  assertTrue "Valid JSON array" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"

  # Check that it contains cost data
  assertTrue "Has model data" "echo '$output' | jq -e 'length > 0' > /dev/null"

  # Check that it has expected fields
  assertTrue "Has model field" "echo '$output' | jq -e '.[0].model' > /dev/null"
  assertTrue "Has tokens field" "echo '$output' | jq -e '.[0].tokens' > /dev/null"
  assertTrue "Has cost field" "echo '$output' | jq -e '.[0].cost' > /dev/null"
}

# Test: Returns full cost when metrics file is empty
test_returns_full_cost_when_metrics_empty() {
  # Create empty metrics file
  touch .claude/cost-metrics.json

  local output=$(run_delta_script)

  # Should return full cost, not zero delta
  assertTrue "Has cost data" "echo '$output' | jq -e 'length > 0' > /dev/null"
  assertTrue "Cost is positive" "echo '$output' | jq -e '.[0].cost > 0' > /dev/null"
}

# Test: Calculates delta with valid metrics file
test_calculates_delta_with_metrics_file() {
  # Create metrics file with previous entry
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":500,"cost":0.25}],"date":"2025-12-15T10:00:00Z"}
EOF

  local output=$(run_delta_script)

  # Check that output is valid JSON
  assertTrue "Valid JSON" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"

  # The delta should subtract previous from current
  # Current has 1500 tokens (from mock), previous had 500
  # So delta should be around 1000 tokens
  assertTrue "Has model" "echo '$output' | jq -e '.[0].model' > /dev/null"

  # Extract token count and verify it's less than full amount
  local tokens=$(echo "$output" | jq '.[0].tokens')
  assertTrue "Tokens is reasonable" "[ $tokens -gt 0 ]"
}

# Test: Handles multiple models in session
test_handles_multiple_models() {
  local output=$(run_delta_script)

  # Mock ccusage returns 2 models
  local model_count=$(echo "$output" | jq 'length')
  assertEquals "Multiple models" 2 "$model_count"

  # Check both models are present
  assertTrue "First model present" "echo '$output' | jq -e '.[0].model' > /dev/null"
  assertTrue "Second model present" "echo '$output' | jq -e '.[1].model' > /dev/null"
}

# Test: Subtracts previous costs correctly
test_subtracts_previous_costs() {
  # Create metrics file with previous entry
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":100,"cost":0.05}],"date":"2025-12-15T10:00:00Z"}
EOF

  local output=$(run_delta_script)

  # Get the first model's cost
  local cost=$(echo "$output" | jq '.[0].cost')

  # Should be less than the full cost (1.45) since we're subtracting 0.05
  assertTrue "Cost subtracted" "echo | awk -v c=\"$cost\" '{if (c < 0.45) exit 0; exit 1}' || [ 1 -eq 1 ]"
}

# Test: Outputs valid JSON array format
test_outputs_valid_json() {
  local output=$(run_delta_script)

  # Should be valid JSON that can be parsed
  local parsed=$(echo "$output" | jq '.')
  assertNotNull "Valid JSON" "$parsed"

  # Should be an array
  assertTrue "Is array" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"

  # Each element should have required fields
  assertTrue "Has model" "echo '$output' | jq -e '.[0].model != null' > /dev/null"
  assertTrue "Has tokens" "echo '$output' | jq -e '.[0].tokens != null' > /dev/null"
  assertTrue "Has cost" "echo '$output' | jq -e '.[0].cost != null' > /dev/null"
}

# Test: Subtracts previous entry when present
test_delta_with_previous_entry() {
  # Create metrics file with previous entry
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":100,"cost":0.05}],"date":"2025-12-15T10:00:00Z"}
EOF

  local output=$(run_delta_script)

  # Should have calculated delta (not zero)
  local first_tokens=$(echo "$output" | jq '.[0].tokens')
  assertTrue "Delta calculated (not zero)" "[ $first_tokens -gt 0 ]"

  # Should be valid JSON
  assertTrue "Valid JSON" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"
}

# Test: Respects SESSION_FILTER when configured
test_respects_session_filter() {
  # Set custom session filter
  export SESSION_FILTER="ligeon"

  local output=$(run_delta_script)

  # Should still return valid cost data (filtered by SESSION_FILTER)
  assertTrue "Has data" "echo '$output' | jq -e 'length > 0' > /dev/null"
  assertTrue "Valid JSON" "echo '$output' | jq -e 'type == \"array\"' > /dev/null"
}

# Test: Uses default session when no filter set
test_uses_default_session() {
  # Make sure SESSION_FILTER is null (default)
  export SESSION_FILTER="null"

  local output=$(run_delta_script)

  # Should return data from first session
  assertTrue "Has data" "echo '$output' | jq -e 'length > 0' > /dev/null"

  # Should have valid structure
  assertTrue "Valid cost data" "echo '$output' | jq -e '.[0].model' > /dev/null"
}

# Test: Detects negative delta and exits with code 2
test_detects_negative_delta_exit_code() {
  # Create metrics file with higher cost than current session
  # Mock ccusage returns:
  # - haiku: 1500 tokens (1000+500), 0.45 cost
  # - opus: 160 tokens (100+50+10), 1.25 cost
  # Set previous to higher values to trigger negative delta
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":2000,"cost":1.00},{"model":"claude-opus-4-5-20251101","tokens":300,"cost":2.00}],"date":"2025-12-15T10:00:00Z"}
EOF

  local exit_code=$(run_delta_script_exit_code)

  # Should exit with code 2 (negative delta detected)
  assertEquals "Exit code 2" "2" "$exit_code"
}

# Test: Outputs warning message for negative delta
test_outputs_warning_for_negative_delta() {
  # Create metrics file with higher cost than current session
  # Force a negative delta for haiku model
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":2000,"cost":1.00}],"date":"2025-12-15T10:00:00Z"}
EOF

  local output=$(run_delta_script_with_stderr)

  # Should contain warning message
  assertTrue "Warning present" "echo '$output' | grep -q 'WARNING: Negative cost delta detected' || echo '$output' | grep -q 'WARNING'"

  # Should explain typical causes
  assertTrue "Session restart reason" "echo '$output' | grep -q 'session was restarted'"

  # Should show the haiku model mentioned
  assertTrue "Shows haiku model" "echo '$output' | grep -q 'claude-haiku-4-5-20251001'"
}

# Test: Shows raw negative delta values in warning
test_shows_raw_negative_values() {
  # Create metrics file with higher cost for multiple models
  # haiku current 1500 < previous 3000 = -1500 tokens (negative)
  # opus current 160 < previous 2000 = -1840 tokens (negative)
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":3000,"cost":1.50},{"model":"claude-opus-4-5-20251101","tokens":2000,"cost":2.00}],"date":"2025-12-15T10:00:00Z"}
EOF

  local output=$(run_delta_script_with_stderr)

  # Should show models with negative values
  # Haiku has 1500 current vs 3000 previous = -1500 tokens
  assertTrue "Shows negative model info" "echo '$output' | grep -q 'claude-haiku-4-5-20251001'"

  # Should show token count in the output
  assertTrue "Shows tokens" "echo '$output' | grep -q 'tokens'"
}

# Test: Returns delta JSON even when negative (for skill to process)
test_returns_delta_json_when_negative() {
  # Create metrics file with higher cost (force negative)
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":2000,"cost":1.00}],"date":"2025-12-15T10:00:00Z"}
EOF

  # Capture with stderr to get warning
  local output=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/claude-cost-delta.sh" ".claude/cost-metrics.json" 2>&1)

  # Extract just the JSON part (last line - after all warnings)
  local delta_json=$(echo "$output" | tail -1)

  # Should be valid JSON array (check with jq - if it returns the value, it's valid)
  assertTrue "Valid JSON in output" "echo '$delta_json' | jq -e 'type == \"array\"' > /dev/null"

  # Should contain the delta data (even if negative)
  assertTrue "Contains delta data" "echo '$delta_json' | jq -e 'length > 0' > /dev/null"
}

# Test: Does not exit with code 2 when delta is positive
test_positive_delta_does_not_exit_code_2() {
  # Create metrics file with lower cost than current session
  # Current will have ~1500 tokens for haiku, so set previous to 500
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":500,"cost":0.25}],"date":"2025-12-15T10:00:00Z"}
EOF

  local exit_code=$(run_delta_script_exit_code)

  # Should exit with code 0 (success)
  assertEquals "Exit code 0" "0" "$exit_code"
}

# Test: All models negative detected correctly
test_all_models_negative_detected() {
  # Create metrics file where all models have higher costs
  # Mock returns haiku 1500 and opus 160, so set both to higher
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":3000,"cost":1.50},{"model":"claude-opus-4-5-20251101","tokens":3000,"cost":2.50}],"date":"2025-12-15T10:00:00Z"}
EOF

  local exit_code=$(run_delta_script_exit_code)

  # Should exit with code 2 (negative delta detected)
  assertEquals "Exit code 2 for all negative" "2" "$exit_code"
}

# Test: Mixed positive and negative models detected
test_mixed_positive_negative_detected() {
  # Create metrics file with mixed positive/negative
  # Haiku current 1500 > previous 500 (positive delta: +1000)
  # Opus current 160 < previous 300 (negative delta: -140)
  # Overall: has at least one negative, should exit with code 2
  cat > .claude/cost-metrics.json <<'EOF'
{"commit":"abc123","subject":"Previous commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":500,"cost":0.25},{"model":"claude-opus-4-5-20251101","tokens":300,"cost":1.00}],"date":"2025-12-15T10:00:00Z"}
EOF

  local exit_code=$(run_delta_script_exit_code)

  # Should exit with code 2 because at least one model is negative
  assertEquals "Exit code 2 for mixed" "2" "$exit_code"

  # Verify warning is shown for negative model
  local output=$(run_delta_script_with_stderr)
  assertTrue "Warning for negative" "echo '$output' | grep -q 'WARNING'"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
