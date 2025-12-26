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
  - No matching default exists → Use `example.json` placeholder template (user must customize)
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

→ Try to get language diagnostics from editor using mcp__ide__getDiagnostics tool
✓ Editor diagnostics available → Parse diagnostics JSON for:
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
→ Identify up to 30 distinct test failures
→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)
→ Proceed to step 6 (Create Fix Plan)

## 6. Create Fix Plan

→ Analyze extracted failures to identify distinct failing tests
→ Use TodoWrite to create todo list with one item per failing test:
  - content: "Fix [test name]"
  - activeForm: "Fixing [test name]"
  - status: "pending"
→ Proceed to step 7 (Ask to Fix Tests)

## 7. Ask to Fix Tests

→ Use AskUserQuestion:
  - "Start fixing tests one by one?" (recommended)
  - "No, I'll fix manually"
  - "Other"

✓ User confirms → Proceed to step 8 (Fix Tests Iteratively)
✗ User declines → Stop

## 8. Fix Tests Iteratively

→ Get next pending test from todo list
→ Mark test as "in_progress" using TodoWrite
→ Initialize retry counter: `RETRY_COUNT=0`

### 8a. Attempt Fix (Iterate up to 3 times)

→ Increment `RETRY_COUNT`
→ Read failing test file and implementation file
→ Implement fix to source code
→ Run specific single test silently to verify fix:
  - Command: `$TEST_SINGLE_CMD > "$TEST_SINGLE_LOG" 2>&1` with test file/class name
  - Capture exit code from command execution
→ Display result to user

✓ Test passes (exit code 0) → Mark todo as "completed", proceed to step 8b
✗ Test still fails (exit code non-zero):
  - If `RETRY_COUNT < 3` → Display failure reason, use AskUserQuestion: "Try again?"
    - "Yes" → Return to step 8a (Attempt Fix again)
    - "No" → Skip this test and proceed to step 8b
  - If `RETRY_COUNT == 3` → Display "Attempted fix 3 times without success"
    → Use AskUserQuestion: "Continue trying to fix this test?"
      - "Yes, keep trying" → Continue from step 8a (increment counter)
      - "No, skip it" → Proceed to step 8b
      - "No, stop for now" → Stop

### 8b. Move to Next Test

→ Use AskUserQuestion:
  - "Fix next test?"
  - "Re-run all tests?" (clear todos, return to step 4)
  - "Stop for now" → Stop
  - "Other"

✓ "Fix next test" → If tests remain, return to step 8; else proceed to step 4 (Run Tests)
✓ "Re-run all tests" → Clear todos with TodoWrite, return to step 4 (Run Tests)
✗ "Stop for now" → Stop

## 9. Success

✅ All tests passed
→ Clear todo list with TodoWrite (empty)
→ Display success message with log file locations

---

**⚠️  CRITICAL EXECUTION RULES**

- **Mandatory flow**: After step 5 (Extract Test Errors) and step 6 (Create Fix Plan), ALWAYS proceed to step 7 (Ask to Fix Tests). Do NOT stop or skip to user.
- **User confirmation required**: ALWAYS ask user via AskUserQuestion in step 7 before proceeding to step 8. Only proceed to step 8 if user confirms.
- **Silent execution**: NEVER use `tee` when running build or test commands. Redirect all output to log files (`> "$LOG_FILE" 2>&1`). Only inspect logs when command returns non-zero exit code.
- **Exit code checking**: Always capture and check exit codes. Zero = success, non-zero = failure.
- **No assumptions**: Never assume errors are "pre-existing" or skip investigating them. All errors must be analyzed unless user explicitly stops the workflow.
