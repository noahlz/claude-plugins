#!/bin/bash
# Tests for skills/write-git-commit/scripts/append-cost-metrics.sh

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

# Helper: Run append-cost-metrics.sh
run_append_script() {
  local metrics_file="${1:-.claude/cost-metrics.jsonl}"
  local commit_sha="${2:-abc123def}"
  local subject="${3:-Test commit}"
  local cost_fixture="${4:-default.json}"

  # Read cost JSON from fixture file
  local cost_json=$(cat "$TESTS_ROOT/fixtures/cost-arrays/$cost_fixture")

  bash "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/append-cost-metrics.sh" "$metrics_file" "$commit_sha" "$subject" "$cost_json"
  return $?
}

# Test: Appends entry to existing metrics file
test_appends_to_existing_file() {
  # Create initial metrics file
  cat > .claude/cost-metrics.jsonl <<'EOF'
{"commit":"abc123","subject":"First commit","cost":[{"model":"claude-haiku-4-5-20251001","tokens":100,"cost":0.05}],"date":"2025-12-15T10:00:00Z"}
EOF

  # Append new entry
  run_append_script
  local exit_code=$?

  # Should succeed
  assertEquals "Append succeeded" 0 "$exit_code"

  # Check that file has two lines now
  local line_count=$(wc -l < .claude/cost-metrics.jsonl | tr -d ' ')
  assertEquals "File has 2 entries" 2 "$line_count"
}

# Test: Creates metrics file if doesn't exist
test_creates_file_if_not_exists() {
  # Ensure file doesn't exist
  [ -f .claude/cost-metrics.jsonl ] && rm .claude/cost-metrics.jsonl

  run_append_script
  local exit_code=$?

  # Check that file was created
  assertEquals "Script succeeded" 0 "$exit_code"
  assertTrue "File created" "[ -f .claude/cost-metrics.jsonl ]"
}

# Test: Creates metrics directory if doesn't exist
test_creates_directory_if_not_exists() {
  # Use a custom path with nested directories
  local custom_dir=".custom/nested/dirs"
  local metrics_path="$custom_dir/cost-metrics.jsonl"

  # Ensure directory doesn't exist
  [ -d "$custom_dir" ] && rm -rf "$custom_dir"

  run_append_script "$metrics_path"
  local exit_code=$?

  # Check that operation succeeded
  assertEquals "Script succeeded" 0 "$exit_code"

  # Check that directory was created
  assertTrue "Directory created" "[ -d $custom_dir ]"

  # Check that file exists
  assertTrue "File created in nested dir" "[ -f $metrics_path ]"
}

# Test: Generates ISO 8601 timestamp
test_generates_iso8601_timestamp() {
  run_append_script

  # Get the last line (our new entry)
  local last_line=$(tail -1 .claude/cost-metrics.jsonl)

  # Extract the date field
  local date=$(echo "$last_line" | jq -r '.date')

  # Check that date matches ISO 8601 pattern (YYYY-MM-DDTHH:MM:SSZ)
  assertTrue "ISO 8601 date format" "echo '$date' | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'"
}

# Test: Formats NDJSON correctly (one line per entry)
test_formats_ndjson_correctly() {
  # Create initial file with one entry
  cat > .claude/cost-metrics.jsonl <<'EOF'
{"commit":"first","subject":"First","cost":[],"date":"2025-12-15T10:00:00Z"}
EOF

  # Append multiple entries
  run_append_script ".claude/cost-metrics.jsonl" "second" "Second" "single-test.json"
  # For third entry, we need a different cost fixture
  local cost_third='[{"model":"test","tokens":20,"cost":0.02}]'
  bash "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/append-cost-metrics.sh" ".claude/cost-metrics.jsonl" "third" "Third" "$cost_third"

  # Check that we have 3 lines
  local line_count=$(wc -l < .claude/cost-metrics.jsonl | tr -d ' ')
  assertEquals "Three entries" 3 "$line_count"

  # Each line should be valid JSON
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      # Just verify jq can parse it
      echo "$line" | jq '.' > /dev/null
      if [ $? -ne 0 ]; then
        fail "Line is not valid JSON: $line"
      fi
    fi
  done < .claude/cost-metrics.jsonl
}

# Test: Entry is valid JSON with required structure
test_entry_valid_json_structure() {
  run_append_script

  local entry=$(cat .claude/cost-metrics.jsonl)

  # Verify it's valid JSON
  echo "$entry" | jq '.' > /dev/null
  assertTrue "Valid JSON" "[ $? -eq 0 ]"

  # Verify required fields exist
  local has_commit=$(echo "$entry" | jq 'has("commit")')
  assertEquals "Has commit" "true" "$has_commit"

  local has_subject=$(echo "$entry" | jq 'has("subject")')
  assertEquals "Has subject" "true" "$has_subject"

  local has_cost=$(echo "$entry" | jq 'has("cost")')
  assertEquals "Has cost" "true" "$has_cost"

  local has_date=$(echo "$entry" | jq 'has("date")')
  assertEquals "Has date" "true" "$has_date"
}

# Test: Subject field is preserved correctly
test_subject_field_preserved() {
  run_append_script ".claude/cost-metrics.jsonl" "abc123" "Fix bug" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)
  local subject=$(echo "$entry" | jq -r '.subject')

  assertEquals "Subject field" "Fix bug" "$subject"
}

# Test: Commit field is stored as short SHA (7 characters)
test_commit_field_is_short_sha() {
  # Use a long SHA (40 characters)
  local long_sha="abc123def456ghi789jkl012mno345pqr6789xyz"
  run_append_script ".claude/cost-metrics.jsonl" "$long_sha" "Test" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)
  local commit=$(echo "$entry" | jq -r '.commit')

  # Should be short SHA (7 characters)
  assertEquals "Commit field is short SHA" "abc123d" "$commit"
}

# Test: Entry includes session_id field
test_entry_has_session_id_field() {
  run_append_script

  local entry=$(cat .claude/cost-metrics.jsonl)

  # Verify session_id field exists
  local has_session_id=$(echo "$entry" | jq 'has("session_id")')
  assertEquals "Has session_id" "true" "$has_session_id"
}

# Test: Session_id uses environment variable when set
test_session_id_from_environment() {
  # Set SESSION_ID environment variable
  export SESSION_ID="test-session-uuid-12345"

  run_append_script ".claude/cost-metrics.jsonl" "abc123" "Test commit" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)
  local session_id=$(echo "$entry" | jq -r '.session_id')

  assertEquals "Session ID from env" "test-session-uuid-12345" "$session_id"
}

# Test: Session_id defaults to "unknown" when not set
test_session_id_defaults_to_unknown() {
  # Unset SESSION_ID so it defaults to "unknown"
  unset SESSION_ID

  run_append_script ".claude/cost-metrics.jsonl" "abc123" "Test commit" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)
  local session_id=$(echo "$entry" | jq -r '.session_id')

  assertEquals "Session ID defaults to unknown" "unknown" "$session_id"
}

# Test: Session_id is preserved across multiple entries
test_session_id_preserved_multiple_entries() {
  # Set specific session ID
  export SESSION_ID="session-uuid-67890"

  # Create first entry
  run_append_script ".claude/cost-metrics.jsonl" "first" "First" "empty.json"

  # Change session ID
  export SESSION_ID="session-uuid-different"

  # Create second entry
  local cost_json='[{"model":"test","tokens":10,"cost":0.01}]'
  bash "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/append-cost-metrics.sh" ".claude/cost-metrics.jsonl" "second" "Second" "$cost_json"

  # Read both entries
  local first_line=$(head -1 .claude/cost-metrics.jsonl)
  local second_line=$(tail -1 .claude/cost-metrics.jsonl)

  # Extract session IDs
  local first_session=$(echo "$first_line" | jq -r '.session_id')
  local second_session=$(echo "$second_line" | jq -r '.session_id')

  # Both should have their own session IDs
  assertEquals "First entry session ID" "session-uuid-67890" "$first_session"
  assertEquals "Second entry session ID" "session-uuid-different" "$second_session"
}

# Test: Session_id field is valid for all JSON parsing
test_session_id_valid_json_string() {
  export SESSION_ID="uuid-with-special-chars-@#$"

  run_append_script ".claude/cost-metrics.jsonl" "abc123" "Test" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)

  # Should be valid JSON even with special characters (properly escaped)
  local parsed=$(echo "$entry" | jq '.')
  assertTrue "JSON parses with special chars" "[ -n '$parsed' ]"

  # Extract and verify session_id
  local session_id=$(echo "$entry" | jq -r '.session_id')
  # Note: jq will unescape the special characters
  assertTrue "Session ID field accessible" "[ -n '$session_id' ]"
}

# Test: Empty SESSION_ID environment variable defaults to "unknown"
test_empty_session_id_defaults_to_unknown() {
  # Set SESSION_ID to empty string
  export SESSION_ID=""

  run_append_script ".claude/cost-metrics.jsonl" "abc123" "Test" "empty.json"

  local entry=$(cat .claude/cost-metrics.jsonl)
  local session_id=$(echo "$entry" | jq -r '.session_id')

  # Empty SESSION_ID should default to "unknown"
  assertEquals "Empty SESSION_ID defaults to unknown" "unknown" "$session_id"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
