---
name: run-and-fix-tests
description: Build the project, run tests and systematically fix any failures. Activate when user says phrases such as "run tests", "test", "build and test" or "fix tests".
---

## 0. Resolve Plugin Root

→ Resolve plugin root environment (check local project first, then user home):
```bash
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  echo "Error: resolve_plugin_root.sh not found in ./.claude/ or $HOME/.claude/" >&2
  exit 1
fi
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || { echo "Error: Failed to resolve plugin root" >&2; exit 1; }
export CLAUDE_PLUGIN_ROOT
```

✓ Plugin root resolved → Proceed to step 1 (Detect Build Configuration)

## 1. Detect Build Configuration

→ Check if `.claude/settings.plugins.run-and-fix-tests.json` exists
✓ Config exists → Proceed to step 2
✗ Config missing → Run detection and auto-config:

→ Source: `${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.sh`
  - Scans project for build tool config files (package.json, pom.xml, build.gradle, etc.)
  - Detects which tools are present
  - Automatically selects and applies appropriate default configuration

→ Auto-selection rules:
  - Exactly 1 tool detected → Use `defaults/{tool}.json`
  - Multiple tools in different locations → Generate polyglot config (🔧 shown to user)
  - Multiple tools in same location → Generate polyglot config
  - No matching default exists → Use `TEMPLATE.json` placeholder template (user must customize)
  - 0 tools detected → Error: no build tools detected

✓ Config created successfully → Proceed to step 2
✗ No tools detected → Error, user must create `.claude/settings.plugins.run-and-fix-tests.json` manually
✗ Using placeholder config → User must edit `.claude/settings.plugins.run-and-fix-tests.json` before step 2

## 2. Load Configuration

→ Execute load-config script to output configuration as eval-able statements:
```bash
eval "$(${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh "${CLAUDE_PLUGIN_ROOT}")"
```
✗ Script fails → Display error and stop
✓ Script succeeds → Environment variables set:
  - BUILD_CMD, BUILD_LOG, BUILD_ERROR_PATTERN, BUILD_WORKING_DIR
  - TEST_CMD, TEST_LOG, TEST_ERROR_PATTERN
  - TEST_SINGLE_CMD, TEST_SINGLE_LOG, TEST_SINGLE_ERROR_PATTERN
  - LOG_DIR (tool-specific, e.g., dist/, build/, target/)
  - BUILD_MULTI (true if multi-build, false if single)

→ Check command argument: `TEST_FILE="$1"`
→ Determine mode:
  - `$TEST_FILE` not empty → Single test mode
  - `$TEST_FILE` empty → All tests mode

→ Store initial working directory: `INITIAL_PWD=$(pwd)`

## 3. Build Project

→ Create log directory: `mkdir -p "$LOG_DIR"`
→ Check build type: `$BUILD_MULTI`

**Single Build:**
→ Change to build working directory: `cd "$BUILD_WORKING_DIR"`
→ Execute build command silently to log file: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
✓ Exit 0 → Return to INITIAL_PWD, proceed to step 4 (Run Tests)
✗ Exit non-zero → Return to INITIAL_PWD, proceed to step 3a (Extract Build Errors)

**Multi-Build:**
→ For each build in detected tools:
  → Change to build working directory
  → Execute build command silently to log file: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
  → On success: continue to next build
  → On failure: return to INITIAL_PWD, proceed to step 3a (Extract Build Errors)

✓ All builds succeed → Return to INITIAL_PWD, proceed to step 4 (Run Tests)

## 3a. Extract Build Errors

→ Try to get language diagnostics from editor using available IDE MCP or LSP tools
✓ MCP or LSP tool available → use it to find and resolve:
  - File paths with errors
  - Line numbers and column positions
  - Error messages and severity
  - Error codes (if available)
  → Display compilation errors to user with file:line references
✗ Editor diagnostics not available or empty → Proceed to log parsing

→ Parse build log at `$BUILD_LOG` using regex from `$BUILD_ERROR_PATTERN`
→ Extract up to 30 distinct compilation errors with:
  - File paths
  - Line numbers (if present in log)
  - Error messages
→ Display compilation error summary to user

→ Use AskUserQuestion: "Build failed with [N] compilation errors. Fix them?"
  - "Yes" → Proceed to step 3b
  - "No" → Stop

## 3b. Fix Compilation Errors

→ For each compilation error identified:
  → Read the file with the error
  → Identify the compilation issue (syntax error, type error, missing import, etc.)
  → Implement fix to the source code
  → Mark error as addressed

→ When all errors are addressed, return to step 3 (Build Project)

## 4. Run Tests

→ Determine test command based on mode:
  - Single test mode: TEST_CMD = `$TEST_SINGLE_CMD` with {testFile} replaced
  - All tests mode: TEST_CMD = `$TEST_CMD`

→ Change to test working directory (if different from build dir)
→ Execute test command silently to log file: `$TEST_CMD > "$TEST_LOG" 2>&1`
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to step 9 (Success)
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to step 5 (Extract Test Errors)

## 5. Extract Test Errors

→ Parse test log at `$TEST_LOG` to identify failing tests
→ Extract error patterns from log using `$TEST_ERROR_PATTERN` regex
→ Identify failing tests (up to 30 distinct failures)

✓ 0 failures detected → Proceed to step 9 (Completion)
✗ 1-30 failures → Display error summary, proceed to step 7
✗ 30+ failures → Display count, proceed to step 7

→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)

## 7. Ask to Fix Tests

→ Check failure count from step 5:

**If 30+ failures:**
⚠️ Display: "30+ tests failed. This is too many for efficient fixing in one chat."
→ Use AskUserQuestion:
  - "Attempt to fix 30+ tests?" (not recommended)
  - "No, I'll stop and create a plan"
→ If "No" → Stop (user exits to create plan)
→ If "Yes" → Continue to step 8

**If 1-29 failures:**
→ Use AskUserQuestion:
  - "Start fixing tests?" (recommended)
  - "No, I'll fix manually"
→ If "Yes" → Continue to step 8
→ If "No" → Stop

## 8. Delegate to Test-Fixer Agent

→ Use the `test-fixer` agent to fix failing tests one-by-one.

→ Provide agent with context in natural language:
  - Failed test list: [bulleted list with test names and error excerpts from step 5]
  - Example failed test entry: "TestLoginFlow (test/auth.test.js) - Expected 'logged in', got undefined"

→ Provide env variable values to agent:
  - TEST_SINGLE_CMD actual value (e.g., "npm test --testNamePattern={testName}")
  - TEST_SINGLE_LOG actual path (e.g., "logs/test-single.log")
  - LOG_DIR actual path (e.g., "logs/")
  - INITIAL_PWD actual path (e.g., "/current/working/directory")

→ Agent fixes the tests per its instructions and context provided.

✓ Agent completes → Proceed to step 8a

## 8a. Ask User to Re-run Tests

→ Use AskUserQuestion:
  - "Re-run all tests to verify fixes?"
  - "No, stop for now"

✓ User confirms → Proceed to step 4 (Run Tests)
✗ User declines → Proceed to step 9

## 9. Completion

→ Check if all originally-failing tests were fixed:
  - If yes → Display: "✅ All tests fixed and passed!"
  - If no → Display: "⚠️ Workflow incomplete. Some tests remain unfixed."

→ Show summary:
  - Tests fixed in this session
  - Tests skipped/remaining
  - Root causes addressed

→ Clear todo list with TodoWrite (empty)
→ Exit

---

**⚠️  CRITICAL EXECUTION RULES**

- **Silent execution**: NEVER use `tee` when running build or test commands. Redirect all output to log files (`> "$LOG_FILE" 2>&1`). Only inspect logs when command returns non-zero exit code.
- **Exit code checking**: Always capture and check exit codes to resolve build and test success/failure. Zero = success, non-zero = failure.
- **No assumptions**: Never assume errors are "pre-existing" or skip investigating them. All errors must be analyzed unless user explicitly stops the workflow.
- **No Git Commits:** DO NOT commit changes as part of this workflow. Users will do that separately.
