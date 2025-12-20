#!/bin/bash
# Tests for skills/write-git-commit/scripts/load-config.sh

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
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Test: Auto-detects session ID from pwd when no config
test_auto_detects_session_id() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/load-config.sh"

  # Should have auto-detected SESSION_ID from pwd
  assertEquals "true" "$SESSION_AUTO_DETECTED"
  assertEquals "false" "$CONFIG_EXISTS"
  # SESSION_ID will be the converted pwd
  assertTrue "[ -n \"$SESSION_ID\" ]"
}

# Test: Loads config from .claude/settings.plugins.write-git-commit.json
test_loads_config_from_file() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create config file with sessionId
  cat > "$TEST_TMPDIR/.claude/settings.plugins.write-git-commit.json" <<'EOF'
{
  "sessionId": "-Users-noahlz-projects-test"
}
EOF

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/load-config.sh"

  # Should load from config file
  assertEquals "-Users-noahlz-projects-test" "$SESSION_ID"
  assertEquals "true" "$CONFIG_EXISTS"
  assertEquals "false" "$SESSION_AUTO_DETECTED"
}

# Test: pwd_to_session_id function converts paths correctly
test_pwd_to_session_id_conversion() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Source the load-config script to get the function
  . "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/load-config.sh" > /dev/null 2>&1 || true

  # Test the function (it may already be available from sourcing)
  # /Users/noahlz/projects/claude-plugins → -Users-noahlz-projects-claude-plugins
  result=$(pwd_to_session_id "/Users/noahlz/projects/claude-plugins")
  assertEquals "-Users-noahlz-projects-claude-plugins" "$result"
}

# Test: Config overrides auto-detected session ID
test_config_overrides_auto_detect() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create config file with sessionId
  cat > "$TEST_TMPDIR/.claude/settings.plugins.write-git-commit.json" <<'EOF'
{
  "sessionId": "-custom-session-id"
}
EOF

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/load-config.sh"

  # Config should override
  assertEquals "-custom-session-id" "$SESSION_ID"
  assertEquals "false" "$SESSION_AUTO_DETECTED"
}

# Test: Validates SESSION_ID is set
test_validates_session_id_set() {
  # This test will be tricky - if we can't get SESSION_ID it should error
  # For now just verify that SESSION_ID is always exported
  mkdir -p "$TEST_TMPDIR/.claude"

  . "$CLAUDE_PLUGIN_ROOT/skills/write-git-commit/scripts/load-config.sh"

  # SESSION_ID should be set
  assertTrue "[ -n \"$SESSION_ID\" ]"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
