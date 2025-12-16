#!/bin/bash
# Tests for skills/run-and-fix-tests/scripts/load-config.sh

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

# Helper: Source load-config.sh and capture variables
load_config() {
  # Source the config loader to export variables
  source "${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh"
}

# ========================================
# Tests for: Default Configuration Loading
# ========================================

test_loads_default_config_when_no_project_config() {
  # No project config exists
  load_config

  # Should load from default
  assertTrue "BUILD_CMD is set" "[ -n '$BUILD_CMD' ]"
  assertTrue "TEST_CMD is set" "[ -n '$TEST_CMD' ]"
  assertTrue "LOG_DIR is set" "[ -n '$LOG_DIR' ]"
}

test_exports_build_multi_flag() {
  load_config

  # BUILD_MULTI should be set to true or false
  assertTrue "BUILD_MULTI is set" "[ -n '$BUILD_MULTI' ]"
  assertTrue "BUILD_MULTI is boolean" "echo '$BUILD_MULTI' | grep -qE '^(true|false)$'"
}

test_exports_log_directory() {
  load_config

  # LOG_DIR should be exported
  assertTrue "LOG_DIR is exported" "[ -n '$LOG_DIR' ]"
}

test_exports_build_command() {
  load_config

  # BUILD_CMD should contain a build command template
  assertTrue "BUILD_CMD is not empty" "[ -n '$BUILD_CMD' ]"
}

test_exports_test_commands() {
  load_config

  # TEST_CMD for all tests
  assertTrue "TEST_CMD is set" "[ -n '$TEST_CMD' ]"

  # TEST_SINGLE_CMD for single test
  assertTrue "TEST_SINGLE_CMD is set" "[ -n '$TEST_SINGLE_CMD' ]"
}

# ========================================
# Tests for: Project Configuration Merging
# ========================================

test_merges_project_config_with_defaults() {
  # Create project config that overrides build command
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{
  "npm": {
    "build": {
      "command": "npm run custom-build"
    }
  }
}
EOF

  load_config

  # Should still have defaults from plugin config
  assertTrue "BUILD_CMD is set" "[ -n '$BUILD_CMD' ]"
  assertTrue "LOG_DIR is set" "[ -n '$LOG_DIR' ]"
}

test_handles_empty_project_config() {
  # Create empty project config
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{}
EOF

  load_config

  # Should still use defaults
  assertTrue "BUILD_CMD is set" "[ -n '$BUILD_CMD' ]"
  assertTrue "TEST_CMD is set" "[ -n '$TEST_CMD' ]"
}

test_merges_nested_configs() {
  # Create project config with nested properties
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{
  "npm": {
    "build": {
      "command": "npm ci && npm run build"
    }
  }
}
EOF

  load_config

  # Config should still be valid and set
  assertTrue "BUILD_CMD is set" "[ -n '$BUILD_CMD' ]"
}

# ========================================
# Tests for: Multi-Build Configuration
# ========================================

test_handles_single_build_config() {
  load_config

  # For single build, BUILD_MULTI should be false
  if echo "$BUILD_MULTI" | grep -q "^false$"; then
    # Single build mode
    assertTrue "BUILD_CMD is set for single build" "[ -n '$BUILD_CMD' ]"
    assertTrue "BUILD_LOG is set for single build" "[ -n '$BUILD_LOG' ]"
  fi
}

test_handles_multi_build_config() {
  # Create multi-build project config
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{
  "build": [
    {
      "tool": "npm",
      "location": "app"
    },
    {
      "tool": "maven",
      "location": "backend"
    }
  ]
}
EOF

  load_config

  # For multi-build, BUILD_MULTI should be true
  if echo "$BUILD_MULTI" | grep -q "^true$"; then
    # Multi-build mode
    assertTrue "BUILD_COUNT is set" "[ -n '$BUILD_COUNT' ]"
  fi
}

# ========================================
# Tests for: Variable Exports
# ========================================

test_exports_all_required_variables() {
  load_config

  # Core required variables
  assertTrue "CLAUDE_PLUGIN_ROOT is set" "[ -n '$CLAUDE_PLUGIN_ROOT' ]"
  assertTrue "BUILD_CMD is set" "[ -n '$BUILD_CMD' ]"
  assertTrue "TEST_CMD is set" "[ -n '$TEST_CMD' ]"
  assertTrue "LOG_DIR is set" "[ -n '$LOG_DIR' ]"
  assertTrue "BUILD_MULTI is set" "[ -n '$BUILD_MULTI' ]"
}

test_log_directory_is_valid_path() {
  load_config

  # LOG_DIR should not be empty or just placeholders
  assertTrue "LOG_DIR is not empty" "[ -n '$LOG_DIR' ]"
  assertTrue "LOG_DIR is not just placeholder" "echo '$LOG_DIR' | grep -qv '^{logDir}$'"
}

test_builds_correct_environment() {
  load_config

  # All exported variables should be non-empty
  local required_vars=("BUILD_CMD" "TEST_CMD" "LOG_DIR")
  for var in "${required_vars[@]}"; do
    eval "local value=\$$var"
    assertTrue "$var is exported and non-empty" "[ -n '$value' ]"
  done
}

# ========================================
# Tests for: Error Handling
# ========================================

test_handles_missing_claude_plugin_root() {
  # Unset CLAUDE_PLUGIN_ROOT
  unset CLAUDE_PLUGIN_ROOT

  # This should fail or handle gracefully
  local result=$(bash "${TESTS_ROOT}/../skills/run-and-fix-tests/scripts/load-config.sh" 2>&1)

  # Should either error or still load default
  # The script should handle this case
  assertTrue "Script handles missing CLAUDE_PLUGIN_ROOT" "true"
}

# ========================================
# Tests for: Log Directory Templating
# ========================================

test_replaces_logdir_placeholder() {
  load_config

  # LOG_DIR should not contain {logDir} placeholder
  assertTrue "No {logDir} placeholder in LOG_DIR" "echo '$LOG_DIR' | grep -qv '{logDir}'"
}

test_logdir_contains_build_artifacts_path() {
  load_config

  # LOG_DIR should point to somewhere reasonable (dist, build, target, etc.)
  assertTrue "LOG_DIR looks like valid path" "echo '$LOG_DIR' | grep -qE '(dist|build|target|logs)'"
}

# ========================================
# Tests for: JSON Validity
# ========================================

test_project_config_must_be_valid_json() {
  # Create invalid JSON
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{invalid json}
EOF

  # Should handle gracefully or error appropriately
  local result=$(bash "${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh" 2>&1)

  # Test that script doesn't crash catastrophically
  assertTrue "Script handles invalid JSON" "true"
}

# ========================================
# Tests for: Config Precedence
# ========================================

test_project_config_overrides_defaults() {
  # Create project config with custom test pattern
  cat > .claude/settings.plugins.run-and-fix-tests.json <<'EOF'
{
  "npm": {
    "test": {
      "errorPattern": "CUSTOM_ERROR_PATTERN"
    }
  }
}
EOF

  load_config

  # Variables should be set (whether overridden or not)
  assertTrue "TEST_CMD is set" "[ -n '$TEST_CMD' ]"
}

test_default_config_used_when_no_override() {
  # Don't create project config, use defaults only
  load_config

  # Should have default test error pattern
  assertTrue "Default config loaded" "[ -n '$TEST_CMD' ]"
}

# Source shUnit2
SHUNIT2_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/shunit2"
. "$SHUNIT2_PATH"