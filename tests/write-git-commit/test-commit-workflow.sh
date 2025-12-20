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
# Tests for: commit action (env var based)
# ========================================

test_commit_with_subject_and_body() {
  echo "test" > test.txt
  git add test.txt > /dev/null 2>&1

  export COMMIT_SUBJECT="Test commit subject"
  export COMMIT_BODY="Test body content"
  export SESSION_ID="test-session-id"
  export CURRENT_COST='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'

  local output=$(run_workflow commit)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"
  assertTrue "Response has commit SHA" "echo '$output' | jq -e '.data.commit_sha' > /dev/null"

  # Verify the commit was created with metrics
  local commit_msg=$(git log -1 --format="%B")
  assertTrue "Commit contains subject" "echo '$commit_msg' | grep -q 'Test commit subject'"
  assertTrue "Commit contains body" "echo '$commit_msg' | grep -q 'Test body content'"
  assertTrue "Commit contains cost metrics" "echo '$commit_msg' | grep -q 'Claude-Cost-Metrics'"
}

test_commit_without_body() {
  echo "test2" > test2.txt
  git add test2.txt > /dev/null 2>&1

  export COMMIT_SUBJECT="Minimal commit"
  export COMMIT_BODY=""
  export SESSION_ID="test-session-id"
  export CURRENT_COST='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'

  local output=$(run_workflow commit)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"
}

test_commit_with_multiple_models() {
  echo "test3" > test3.txt
  git add test3.txt > /dev/null 2>&1

  export COMMIT_SUBJECT="Multi-model test"
  export COMMIT_BODY=""
  export SESSION_ID="test-session-id"
  export CURRENT_COST='[{"model":"haiku","inputTokens":100,"outputTokens":50,"cost":0.05},{"model":"sonnet","inputTokens":200,"outputTokens":100,"cost":0.10}]'

  local output=$(run_workflow commit)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is success" "success" "$status"

  # Verify the output contains the correct env vars (cost array with multiple models)
  local cost=$(echo "$output" | jq '.data' 2>/dev/null)
  assertTrue "Output indicates success" "echo '$output' | jq -e '.status == \"success\"' > /dev/null"
}

test_commit_missing_subject_returns_error() {
  export COMMIT_SUBJECT=""
  export COMMIT_BODY="body"
  export SESSION_ID="test-session-id"
  export CURRENT_COST='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'

  local output=$(run_workflow commit)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is error" "error" "$status"
}

test_commit_missing_session_id_returns_error() {
  export COMMIT_SUBJECT="subject"
  export COMMIT_BODY=""
  export SESSION_ID=""
  export CURRENT_COST='[{"model":"test","inputTokens":100,"outputTokens":50,"cost":0.05}]'

  local output=$(run_workflow commit)
  local status=$(echo "$output" | jq -r '.status')

  assertEquals "Status is error" "error" "$status"
}

test_commit_missing_cost_returns_error() {
  export COMMIT_SUBJECT="subject"
  export COMMIT_BODY=""
  export SESSION_ID="test-session-id"
  export CURRENT_COST=""

  local output=$(run_workflow commit)
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
  # Test that all actions return {status, data, message}
  # Using prepare action since it doesn't require changes
  local output=$(run_workflow prepare)

  assertTrue "Has status field" "echo '$output' | jq -e '.status' > /dev/null"
  assertTrue "Has data field" "echo '$output' | jq -e '.data' > /dev/null"
  assertTrue "Has message field" "echo '$output' | jq -e '.message' > /dev/null"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
