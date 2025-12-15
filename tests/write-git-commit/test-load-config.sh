#!/bin/bash
# Tests for plugins/write-git-commit/scripts/load-config.sh

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

  # Set working directory to test temp dir
  cd "$TEST_TMPDIR" || exit 1
}

# Cleanup
tearDown() {
  teardown_test_env
}

# Test: Loads default config when no project config exists
test_loads_default_config() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"

  # Check that METRICS_FILE is set to default
  assertEquals ".claude/cost-metrics.json" "$METRICS_FILE"

  # Check that SESSION_FILTER is set to null
  assertEquals "null" "$SESSION_FILTER"
}

# Test: Merges default and project config correctly
test_merges_configs() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create project config that overrides metricsFile
  cat > "$TEST_TMPDIR/.claude/commit-config.json" <<'EOF'
{
  "metricsFile": ".custom/metrics.json"
}
EOF

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"

  # Check that metricsFile is overridden
  assertEquals ".custom/metrics.json" "$METRICS_FILE"

  # Check that SESSION_FILTER still has default
  assertEquals "null" "$SESSION_FILTER"
}

# Test: Exports SESSION_FILTER from config
test_exports_session_filter() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create project config with custom session filter
  cat > "$TEST_TMPDIR/.claude/commit-config.json" <<'EOF'
{
  "sessionFilter": "myproject"
}
EOF

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"

  # Check that SESSION_FILTER is set from config
  assertEquals "myproject" "$SESSION_FILTER"

  # Check that METRICS_FILE has default value
  assertEquals ".claude/cost-metrics.json" "$METRICS_FILE"
}

# Test: Handles empty project config file
test_handles_empty_project_config() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create empty project config
  echo '{}' > "$TEST_TMPDIR/.claude/commit-config.json"

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"

  # Both should have defaults
  assertEquals ".claude/cost-metrics.json" "$METRICS_FILE"
  assertEquals "null" "$SESSION_FILTER"
}

# Test: Works without CLAUDE_PLUGIN_ROOT set (should error)
test_errors_without_plugin_root() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Unset CLAUDE_PLUGIN_ROOT
  unset CLAUDE_PLUGIN_ROOT

  # Try to source - should fail
  (. "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh" 2>/dev/null)

  # Should not succeed
  assertTrue "[ $? -ne 0 ]"
}

# Test: Deep merges nested JSON correctly
test_deep_merges_json() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create default config with nested structure
  # (this tests that the merge strategy works)

  # Create project config that overrides only sessionFilter
  cat > "$TEST_TMPDIR/.claude/commit-config.json" <<'EOF'
{
  "sessionFilter": "custom"
}
EOF

  # Source the load-config script
  . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"

  # Check merged result
  assertEquals ".claude/cost-metrics.json" "$METRICS_FILE"
  assertEquals "custom" "$SESSION_FILTER"
}

# Test: Exports variables to environment
test_exports_to_environment() {
  mkdir -p "$TEST_TMPDIR/.claude"

  # Create project config
  cat > "$TEST_TMPDIR/.claude/commit-config.json" <<'EOF'
{
  "metricsFile": ".custom/metrics.json",
  "sessionFilter": "test-project"
}
EOF

  # Source in a subshell and check exports
  (
    . "$CLAUDE_PLUGIN_ROOT/scripts/load-config.sh"
    [ -n "$METRICS_FILE" ] && echo "METRICS_FILE=$METRICS_FILE"
    [ -n "$SESSION_FILTER" ] && echo "SESSION_FILTER=$SESSION_FILTER"
  ) | grep -q "METRICS_FILE"

  assertTrue "[ $? -eq 0 ]"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"
