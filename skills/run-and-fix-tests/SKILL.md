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
✓ Exit 0 → Return to INITIAL_PWD, proceed to section 3 (Run Tests)
✗ Exit non-zero → Return to INITIAL_PWD, proceed to section 2a (Extract Build Errors)

**Multi-Build:**
→ For each build in detected tools:
  → Change to build working directory
  → Execute build command silently to log file: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
  → On success: continue to next build
  → On failure: return to INITIAL_PWD, proceed to section 2a (Extract Build Errors)

✓ All builds succeed → Return to INITIAL_PWD, proceed to section 3 (Run Tests)

## 2a. Extract Build Errors

→ **Step 2a: Attempt Editor Integration (if available)**
  → Try to get language diagnostics from active editor (VSCode/IDE with MCP support)
  ✓ Editor diagnostics available → Use them to identify compilation errors (file paths, line numbers, error details)
  ✗ Editor integration not available → Proceed to step 2b

→ **Step 2b: Fallback to Log Parsing**
  → Parse build log using BUILD_ERROR_PATTERN regex
  → Extract error messages and file locations from log output
  → Identify up to 30 distinct errors

→ Ask user: "Build failed. Should I fix it?"
  - "Yes" → Analyze and fix issues, return to step 2
  - "No" → Stop

## 3. Run Tests

→ Determine test command based on mode:
  - Single test mode: TEST_CMD = `$TEST_SINGLE_CMD` with {testFile} replaced
  - All tests mode: TEST_CMD = `$TEST_CMD`

→ Change to test working directory (if different from build dir)
→ Execute test command silently to log file: `$TEST_CMD > "$TEST_LOG" 2>&1`
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to section 6 (Ask to Fix Tests)
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to section 4 (Extract Test Errors)

## 4. Extract Test Errors

→ Parse test log to identify failing tests
→ Extract error patterns from log using TEST_ERROR_PATTERN regex
→ Identify up to 30 distinct test failures
→ Display error summary to user with:
  - List of failing tests
  - Error messages and relevant output from test log
→ Proceed to section 5 (Create Fix Plan)

## 5. Create Fix Plan

→ Analyze failures to identify distinct failing tests
→ Use TodoWrite to create todo list (one per failing test)
→ Status: "pending"
→ Proceed to section 6 (Ask to Fix Tests)

## 6. Ask to Fix Tests

→ Use AskUserQuestion:
  - "Start fixing tests one by one?" (recommended)
  - "No, I'll fix manually"
  - "Other"

✓ "Yes" → Proceed to section 7 (Fix Tests Iteratively)
✗ "No" → Stop

## 7. Fix Tests Iteratively

→ Get next pending test from todo list
→ Mark as "in_progress"
→ Initialize retry counter: `RETRY_COUNT=0`

### 7a. Attempt Fix (Iterate up to 3 times)

→ Increment `RETRY_COUNT`
→ Analyze the failing test error and identify what needs to be fixed
→ **Modify the source code** to address the root cause
→ Run the **specific single test** (test class or test file) silently to verify the fix:
  - For unit tests: `$TEST_SINGLE_CMD > "$TEST_SINGLE_LOG" 2>&1` with the test file/class name
  - Capture exit code from command execution
→ Display result to user

✓ Test passes → Mark todo as "completed", proceed to section 7b
✗ Test still fails:
  - If `RETRY_COUNT < 3` → Display failure reason, ask "Try again?"
    - "Yes" → Return to section 7a (Attempt Fix again)
    - "No" → Skip this test and proceed to section 7b
  - If `RETRY_COUNT == 3` → Display "Attempted fix 3 times without success"
    → Use AskUserQuestion: "Continue trying to fix this test?"
      - "Yes, keep trying" → Continue from section 7a (increment counter)
      - "No, skip it" → Proceed to section 7b
      - "No, stop for now" → Stop

### 7b. Move to Next Test

→ Use AskUserQuestion:
  - "Fix next test?" (if more remain, recommended)
  - "Re-run all tests?" (clear todos, return to section 3)
  - "Stop for now" → Stop
  - "Other"

✓ "Fix next test" → If tests remain, return to section 7 (Fix Tests Iteratively); else proceed to section 3 (Run Tests)
✓ "Re-run all tests" → Clear todos, return to section 3 (Run Tests)
✗ "Stop for now" → Stop

## 8. Success

✅ All tests passed
→ Clear todo list with TodoWrite (empty)
→ Display success message with log file locations

---

**⚠️  CRITICAL DIRECTIVES**

- NEVER use the `tee` command when building source or executing tests. All output should redirect to log files, that you inspect later based on the command return code (non-zero indicates failure).
- NEVER assume compilation errors or test failures are "pre-existing."
- Investigate all errors and failures to their root cause (unless user halts the workflow).
