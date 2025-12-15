---
name: run-and-fix-tests
description: Build project and run tests with clean output, fix any failures. Activate when user says "run tests", "test", "build and test", "fix tests", or "make test".
---

## 0. Detect Build Configuration

→ Check if `.claude/build-config.json` exists and is not empty
✓ Config exists → Proceed to step 1
✗ Config missing/empty → Run detection script:

→ Source: `${CLAUDE_PLUGIN_ROOT}/scripts/detect-and-resolve.sh`
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

✓ User confirms → Save config to `.claude/build-config.json` and proceed to step 1
✗ User declines → Stop, user creates `.claude/build-config.json` manually

## 1. Load Configuration

→ Source: `${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh`
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
→ Execute build command (using BUILD_CMD, BUILD_LOG, BUILD_ERROR_PATTERN)
✓ Exit 0 → Return to INITIAL_PWD, proceed to step 3
✗ Exit non-zero → Extract errors from log
  → Return to INITIAL_PWD
  → Ask user: "Build failed. Should I fix it?"
    - "Yes" → Analyze and fix issues, return to step 2
    - "No" → Stop

**Multi-Build:**
→ For each build in detected tools:
  → Change to build working directory
  → Execute build command
  → On failure: extract errors, return to INITIAL_PWD, ask user to fix
  → On success: continue to next build

✓ All builds succeed → Return to INITIAL_PWD, proceed to step 3
✗ Any build fails → Return to INITIAL_PWD, ask user: "Build failed in [tool]. Should I fix it?"
  - "Yes" → Analyze and fix, return to step 2
  - "No" → Stop

## 3. Run Tests

→ Determine test command based on mode:
  - Single test mode: TEST_CMD = `$TEST_SINGLE_CMD` with {testFile} replaced
  - All tests mode: TEST_CMD = `$TEST_CMD`

→ Change to test working directory (if different from build dir)
→ Execute test command (log to $TEST_LOG)
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to step 6
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to step 4

## 4. Extract Errors

→ Parse test log to identify failing tests
→ Extract error patterns from log (up to 30 errors)
→ Display error summary to user

## 5. Create Fix Plan

→ Analyze failures to identify distinct failing tests
→ Use TodoWrite to create todo list (one per failing test)
→ Status: "pending"

## 6. Ask to Fix Tests

→ Use AskUserQuestion:
  - "Start fixing tests one by one?" (recommended)
  - "No, I'll fix manually"
  - "Other"

✓ "Yes" → Proceed to step 7
✗ "No" → Stop

## 7. Fix Tests Iteratively

→ Get next pending test from todo list
→ Mark as "in_progress"
→ Fix the test (modify relevant code)
→ Mark as "completed"
→ Use AskUserQuestion:
  - "Fix next test?" (if more remain)
  - "Re-run all tests?"
  - "Stop for now"
  - "Other"

✓ "Fix next test" → If tests remain, return to step 7; else run step 3
✓ "Re-run all tests" → Clear todos, return to step 3
✗ "Stop for now" → Stop

## 8. Success

✅ All tests passed
→ Clear todo list with TodoWrite (empty)
→ Display success message with log file locations

🔧 Configuration: `.claude/build-config.json` (optional project override)
📁 Logs directory: `$LOG_DIR` (tool-specific: dist/ for npm, target/ for maven, build/ for gradle, etc.)