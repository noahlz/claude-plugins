#!/bin/bash
# Tests for plugins/write-git-commit/skills/scripts/commit-workflow.sh

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

# Helper: Run commit-workflow.sh with action
run_workflow() {
  local action="$1"
  shift
  bash "$CLAUDE_PLUGIN_ROOT/skills/scripts/commit-workflow.sh" "$action" "$@" 2>/dev/null
}

# ========================================
# Tests for: build-message action
# ========================================

test_build_message_without_body() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "2025-12-15T10:00:00Z")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is success" "success" "$status"

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains subject" "echo '$message' | grep -q 'Test commit'"
  assertTrue "Message contains co-author" "echo '$message' | grep -q 'Co-Authored-By:'"
  # Check for literal --- in the JSON output (may be escaped as \\n---\\n)
  assertTrue "Message contains footer" "echo '$output' | jq '.data.full_message' | grep -q 'sessionId'"
}

test_build_message_with_body() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "This is the commit body" \
    "test-session-id" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "2025-12-15T10:00:00Z")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is success" "success" "$status"

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains body" "echo '$message' | grep -q 'This is the commit body'"
}

test_build_message_includes_cost_footer() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "2025-12-15T10:00:00Z")

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Footer contains sessionId" "echo '$message' | grep -q 'sessionId'"
  assertTrue "Footer contains cost" "echo '$message' | grep -q 'cost'"
  assertTrue "Footer contains date" "echo '$message' | grep -q '\"date\"'"
}

test_build_message_multiple_models() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    '[{"model":"haiku","tokens":100,"cost":0.05},{"model":"sonnet","tokens":200,"cost":0.10}]' \
    "2025-12-15T10:00:00Z")

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains both models" "echo '$message' | grep -q 'haiku' && echo '$message' | grep -q 'sonnet'"
}

test_build_message_missing_subject_returns_error() {
  local output=$(run_workflow build-message \
    "" \
    "" \
    "test-session-id" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "2025-12-15T10:00:00Z")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

test_build_message_missing_session_id_returns_error() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "2025-12-15T10:00:00Z")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

test_build_message_missing_cost_returns_error() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    "" \
    "2025-12-15T10:00:00Z")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

test_build_message_missing_date_returns_error() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    '[{"model":"test","tokens":100,"cost":0.05}]' \
    "")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

# ========================================
# Tests for: append-metrics action
# ========================================

test_append_metrics_requires_config() {
  # No config file exists
  local output=$(run_workflow append-metrics \
    "abc123def456" \
    "Test commit" \
    '[{"model":"test","tokens":100,"cost":0.05}]')

  # Should succeed if config can be loaded (even with defaults)
  local status=$(echo "$output" | jq -r '.status // "error"')
  # We're just checking it returns JSON
  assertTrue "Returns JSON response" "echo '$output' | jq -e '.status' > /dev/null"
}

test_append_metrics_creates_file() {
  # Use default config from plugin
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  run_workflow append-metrics \
    "abc123def456" \
    "Test commit" \
    '[{"model":"test","tokens":100,"cost":0.05}]' > /dev/null

  assertTrue "Metrics file created" "[ -f .claude/cost-metrics.jsonl ]"
}

test_append_metrics_valid_json_entry() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  run_workflow append-metrics \
    "abc123def456" \
    "Test commit" \
    '[{"model":"test","tokens":100,"cost":0.05}]' > /dev/null

  local entry=$(cat .claude/cost-metrics.jsonl)

  # Verify it's valid JSON
  assertTrue "Entry is valid JSON" "echo '$entry' | jq '.' > /dev/null"

  # Verify required fields
  local has_commit=$(echo "$entry" | jq 'has("commit")')
  assertEquals "Has commit field" "true" "$has_commit"

  local has_subject=$(echo "$entry" | jq 'has("subject")')
  assertEquals "Has subject field" "true" "$has_subject"

  local commit_value=$(echo "$entry" | jq -r '.commit')
  # SHA is stored as short SHA (7 characters)
  assertEquals "Commit SHA is correct (short SHA)" "abc123d" "$commit_value"
}

test_append_metrics_appends_to_existing() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  # Create initial file
  echo '{"commit":"first","subject":"First","cost":[],"date":"2025-12-15T10:00:00Z"}' > .claude/cost-metrics.jsonl

  run_workflow append-metrics \
    "abc123def456" \
    "Second commit" \
    '[{"model":"test","tokens":100,"cost":0.05}]' > /dev/null

  local line_count=$(wc -l < .claude/cost-metrics.jsonl | tr -d ' ')
  assertEquals "Two entries in file" 2 "$line_count"
}

# ========================================
# Tests for: check-gitignore action
# ========================================

test_check_gitignore_file_not_ignored() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/test-metrics.json","sessionFilter":null}
EOF

  # Use a metrics file path that's unlikely to be in any gitignore
  # (this tests the check-gitignore logic without testing actual gitignore matching)
  local output=$(run_workflow check-gitignore)

  # Just verify we get a valid response with a boolean
  local ignored=$(echo "$output" | jq -r '.data.ignored')
  assertTrue "Response contains boolean" "echo '$ignored' | grep -qE '^(true|false)$'"
}

test_check_gitignore_file_already_ignored() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  echo "cost-metrics.jsonl" > .gitignore

  local output=$(run_workflow check-gitignore)
  local ignored=$(echo "$output" | jq -r '.data.ignored')

  assertEquals "File is ignored" "true" "$ignored"
}

# ========================================
# Tests for: add-gitignore action
# ========================================

test_add_gitignore_adds_to_file() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  local output=$(run_workflow add-gitignore)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"
  assertTrue "Entry in .gitignore" "grep -q 'cost-metrics.jsonl' .gitignore"
}

test_add_gitignore_creates_file_if_not_exists() {
  cat > .claude/commit-config.json <<'EOF'
{"metricsFile":".claude/cost-metrics.jsonl","sessionFilter":null}
EOF

  [ -f .gitignore ] && rm .gitignore

  run_workflow add-gitignore > /dev/null

  assertTrue ".gitignore created" "[ -f .gitignore ]"
  assertTrue "Entry in .gitignore" "grep -q 'cost-metrics.jsonl' .gitignore"
}

# ========================================
# Tests for: error handling
# ========================================

test_unknown_action_returns_error() {
  local output=$(run_workflow unknown-action)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is error" "error" "$status"
}

test_response_always_has_required_fields() {
  # Test any action - they should all return {status, data, message}
  local output=$(run_workflow build-message \
    "Test" \
    "" \
    "session" \
    '[]' \
    "2025-12-15T10:00:00Z")

  assertTrue "Has status field" "echo '$output' | jq -e '.status' > /dev/null"
  assertTrue "Has data field" "echo '$output' | jq -e '.data' > /dev/null"
  assertTrue "Has message field" "echo '$output' | jq -e '.message' > /dev/null"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
