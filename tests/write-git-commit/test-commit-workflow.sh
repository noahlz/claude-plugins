#!/bin/bash
# Tests for skills/write-git-commit/scripts/commit-workflow.sh

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

  # Set up mocks path (prepend to PATH so mocks are found first)
  export PATH="$TESTS_ROOT/lib/mocks:$PATH"

  # Set working directory to test temp dir
  cd "$TEST_TMPDIR" || exit 1

  # Create .claude directory and git repo
  mkdir -p .claude
  git init > /dev/null 2>&1
  git config user.email "test@example.com" > /dev/null 2>&1
  git config user.name "Test User" > /dev/null 2>&1
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Helper: Run commit-workflow.sh with action
run_workflow() {
  local action="$1"
  shift
  bash "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/commit-workflow.sh" "$action" "$@" 2>/dev/null
}

# ========================================
# Tests for: prepare action
# ========================================

test_prepare_returns_success_with_session_id() {
  # Create a config file with a valid session ID
  cat > .claude/settings.plugins.write-git-commit.json <<'EOF'
{"sessionId":"-Users-noahlz-projects-claude-plugins"}
EOF

  local output=$(run_workflow prepare)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"
}

test_prepare_returns_session_id_in_data() {
  # Create a config file
  cat > .claude/settings.plugins.write-git-commit.json <<'EOF'
{"sessionId":"-Users-noahlz-projects-claude-plugins"}
EOF

  local output=$(run_workflow prepare)
  local session_id=$(echo "$output" | jq -r '.data.session_id')

  assertEquals "Session ID in response" "-Users-noahlz-projects-claude-plugins" "$session_id"
}

test_prepare_returns_current_cost() {
  # Create a config file
  cat > .claude/settings.plugins.write-git-commit.json <<'EOF'
{"sessionId":"-Users-noahlz-projects-claude-plugins"}
EOF

  local output=$(run_workflow prepare)
  local cost=$(echo "$output" | jq '.data.current_cost')

  assertTrue "Current cost is array" "echo '$cost' | jq -e 'type == \"array\"' > /dev/null"
}

# ========================================
# Tests for: build-message action
# ========================================

test_build_message_without_body() {
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    "$cost")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is success" "success" "$status"

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains subject" "echo '$message' | grep -q 'Test commit'"
  assertTrue "Message contains co-author" "echo '$message' | grep -q 'Co-Authored-By:'"
}

test_build_message_with_body() {
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "Test commit" \
    "This is the commit body" \
    "test-session-id" \
    "$cost")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is success" "success" "$status"

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains body" "echo '$message' | grep -q 'This is the commit body'"
}

test_build_message_includes_cost_footer() {
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    "$cost")

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Footer contains sessionId" "echo '$message' | grep -q 'sessionId'"
  assertTrue "Footer contains cost" "echo '$message' | grep -q 'cost'"
}

test_build_message_multiple_models() {
  local cost='[{"model":"haiku","inputTokens":100,"outputTokens":50,"cost":0.05},{"model":"sonnet","inputTokens":200,"outputTokens":100,"cost":0.10}]'
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    "$cost")

  local message=$(echo "$output" | jq -r '.data.full_message')
  assertTrue "Message contains both models" "echo '$message' | grep -q 'haiku' && echo '$message' | grep -q 'sonnet'"
}

test_build_message_missing_subject_returns_error() {
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "" \
    "" \
    "test-session-id" \
    "$cost")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

test_build_message_missing_session_id_returns_error() {
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "" \
    "$cost")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

test_build_message_missing_cost_returns_error() {
  local output=$(run_workflow build-message \
    "Test commit" \
    "" \
    "test-session-id" \
    "")

  local status=$(echo "$output" | jq -r '.status')
  assertEquals "Status is error" "error" "$status"
}

# ========================================
# Tests for: create-commit action
# ========================================

test_create_commit_success() {
  # First create a commit to test against
  echo "test" > test.txt
  git add test.txt > /dev/null 2>&1

  local message="Test commit message"
  local output=$(run_workflow create-commit "$message")
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"
}

test_create_commit_missing_message_returns_error() {
  echo "test" > test.txt
  git add test.txt > /dev/null 2>&1

  local output=$(run_workflow create-commit "")
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is error" "error" "$status"
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
  local cost='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'
  local output=$(run_workflow build-message \
    "Test" \
    "" \
    "session" \
    "$cost")

  assertTrue "Has status field" "echo '$output' | jq -e '.status' > /dev/null"
  assertTrue "Has data field" "echo '$output' | jq -e '.data' > /dev/null"
  assertTrue "Has message field" "echo '$output' | jq -e '.message' > /dev/null"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
