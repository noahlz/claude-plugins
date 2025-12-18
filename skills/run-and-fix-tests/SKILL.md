---
name: run-and-fix-tests
description: Build project and run tests with clean output, fix any failures. Activate when user says "run tests", "test", "build and test", "fix tests", or "make test".
---

## 0. Detect Build Configuration

→ Check if `.claude/settings.plugins.run-and-fix-tests.json` exists and is not empty
✓ Config exists → Proceed to step 1
✗ Config missing/empty → Run detection script:

→ Source: `${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.sh`
  - Scans project for build tool config files (package.json, pom.xml, build.gradle, etc.)
  - Loads merged config (default + project override)
  - Returns: `$DETECTED_TOOLS` (JSON array), `$BUILD_CONFIG` (merged config)

→ Check number of detected tools:
  - Exactly 1 tool → Propose single build configuration
  - Multiple tools → Proceed to step 0a
  - 0 tools → Error: no build tools detected

## 0a. Resolve Ambiguity (if multiple tools at same location)

→ Check if all detected tools are in same directory (e.g., all in project root)
✓ All in different directories → Proceed to multi-build proposal
✗ Multiple tools in same directory → Ask user to choose:

→ Use AskUserQuestion:
  - Question: "Multiple build tools detected in [location]. Which should I use?"
  - Options: List detected tools as choices
  - Recommended: First detected tool

✓ User selects tool → Create single-build config with selected tool, proceed to step 1
✗ User chooses "Other/Configure manually" → Stop

## 0b. Propose Configuration

→ Display detected tools and their locations:
  - Single tool: "Detected [tool] at [location]"
  - Multiple tools: "Detected [tool1] at [location1], [tool2] at [location2], etc."

→ Use AskUserQuestion to confirm:
  - "Proceed with these build tools?" (recommended)
  - "No, I'll configure manually"
  - "Other"

✓ User confirms → Save config to `.claude/settings.plugins.run-and-fix-tests.json` and proceed to step 1
✗ User declines → Stop, user creates `.claude/settings.plugins.run-and-fix-tests.json` manually

## 1. Load Configuration

→ Source: `${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.sh`
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

## 2. Build Project

→ Create log directory: `mkdir -p "$LOG_DIR"`
→ Check build type: `$BUILD_MULTI`

**Single Build:**
→ Change to build working directory: `cd "$BUILD_WORKING_DIR"`
→ Execute build command silently to log file: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
✓ Exit 0 → Return to INITIAL_PWD, proceed to step 3 (Run Tests)
✗ Exit non-zero → Return to INITIAL_PWD, proceed to step 2a (Extract Build Errors)

**Multi-Build:**
→ For each build in detected tools:
  → Change to build working directory
  → Execute build command silently to log file: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
  → On success: continue to next build
  → On failure: return to INITIAL_PWD, proceed to step 2a (Extract Build Errors)

✓ All builds succeed → Return to INITIAL_PWD, proceed to step 3 (Run Tests)

## 2a. Extract Build Errors

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
  - "Yes" (recommended) → Proceed to step 2b
  - "No" → Stop

## 2b. Fix Compilation Errors

→ For each compilation error identified:
  → Read the file with the error
  → Identify the compilation issue (syntax error, type error, missing import, etc.)
  → Implement fix to the source code
  → Mark error as addressed

→ When all errors are addressed, return to step 2 (Build Project)

## 3. Run Tests

→ Determine test command based on mode:
  - Single test mode: TEST_CMD = `$TEST_SINGLE_CMD` with {testFile} replaced
  - All tests mode: TEST_CMD = `$TEST_CMD`

→ Change to test working directory (if different from build dir)
→ Execute test command silently to log file: `$TEST_CMD > "$TEST_LOG" 2>&1`
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to step 8 (Success)
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to step 4 (Extract Test Errors)

## 4. Extract Test Errors

→ Parse test log at `$TEST_LOG` to identify failing tests
→ Extract error patterns from log using `$TEST_ERROR_PATTERN` regex
→ Identify up to 30 distinct test failures
→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)
→ Proceed to step 5 (Create Fix Plan)

## 5. Create Fix Plan

→ Analyze extracted failures to identify distinct failing tests
→ Use TodoWrite to create todo list with one item per failing test:
  - content: "Fix [test name]"
  - activeForm: "Fixing [test name]"
  - status: "pending"
→ Proceed to step 6 (Ask to Fix Tests)

## 6. Ask to Fix Tests

→ Use AskUserQuestion:
  - "Start fixing tests one by one?" (recommended)
  - "No, I'll fix manually"
  - "Other"

✓ User confirms → Proceed to step 7 (Fix Tests Iteratively)
✗ User declines → Stop

## 7. Fix Tests Iteratively

→ Get next pending test from todo list
→ Mark test as "in_progress" using TodoWrite
→ Initialize retry counter: `RETRY_COUNT=0`

### 7a. Attempt Fix (Iterate up to 3 times)

→ Increment `RETRY_COUNT`
→ Read failing test file and implementation file
→ Implement fix to source code
→ Run specific single test silently to verify fix:
  - Command: `$TEST_SINGLE_CMD > "$TEST_SINGLE_LOG" 2>&1` with test file/class name
  - Capture exit code from command execution
→ Display result to user

✓ Test passes (exit code 0) → Mark todo as "completed", proceed to step 7b
✗ Test still fails (exit code non-zero):
  - If `RETRY_COUNT < 3` → Display failure reason, use AskUserQuestion: "Try again?"
    - "Yes" → Return to step 7a (Attempt Fix again)
    - "No" → Skip this test and proceed to step 7b
  - If `RETRY_COUNT == 3` → Display "Attempted fix 3 times without success"
    → Use AskUserQuestion: "Continue trying to fix this test?"
      - "Yes, keep trying" → Continue from step 7a (increment counter)
      - "No, skip it" → Proceed to step 7b
      - "No, stop for now" → Stop

### 7b. Move to Next Test

→ Use AskUserQuestion:
  - "Fix next test?" (if more remain, recommended)
  - "Re-run all tests?" (clear todos, return to step 3)
  - "Stop for now" → Stop
  - "Other"

✓ "Fix next test" → If tests remain, return to step 7; else proceed to step 3 (Run Tests)
✓ "Re-run all tests" → Clear todos with TodoWrite, return to step 3 (Run Tests)
✗ "Stop for now" → Stop

## 8. Success

✅ All tests passed
→ Clear todo list with TodoWrite (empty)
→ Display success message with log file locations

---

**⚠️  CRITICAL EXECUTION RULES**

- **Mandatory flow**: After step 4 (Extract Test Errors) and step 5 (Create Fix Plan), ALWAYS proceed to step 6 (Ask to Fix Tests). Do NOT stop or skip to user.
- **User confirmation required**: ALWAYS ask user via AskUserQuestion in step 6 before proceeding to step 7. Only proceed to step 7 if user confirms.
- **Silent execution**: NEVER use `tee` when running build or test commands. Redirect all output to log files (`> "$LOG_FILE" 2>&1`). Only inspect logs when command returns non-zero exit code.
- **Exit code checking**: Always capture and check exit codes. Zero = success, non-zero = failure.
- **No assumptions**: Never assume errors are "pre-existing" or skip investigating them. All errors must be analyzed unless user explicitly stops the workflow.
