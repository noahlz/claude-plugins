---
name: run-and-fix-tests
description: Build project and run tests with clean output, fix any failures. Activate when user says "run tests", "test", "build and test", "fix tests", or "make test".
---

## 1. Load Configuration

→ Run: `source ${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh`
✗ Script fails → Display error and stop
✓ Configuration loaded and merged
→ Check command arguments: `TEST_FILE="$1"`
→ Determine mode:
  - If `$TEST_FILE` is set → Single test mode
  - If `$TEST_FILE` is empty → All tests mode
→ Use in subsequent steps:
  - `$BUILD_CMD` - Build command (default: `npm run build`)
  - `$BUILD_LOG` - Build log file (default: `dist/build.log`)
  - `$BUILD_ERROR_PATTERN` - Build error regex (default: `(error|Error|✘)`)
  - `$TEST_CMD` - All tests command (default: `npm test`)
  - `$TEST_LOG` - All tests log file (default: `dist/test.log`)
  - `$TEST_ERROR_PATTERN` - Test error regex (default: `(FAIL|●|Error:|Expected|Received)`)
  - `$TEST_SINGLE_CMD` - Single test command template (default: `npm test -- {testFile}`)
  - `$TEST_SINGLE_LOG` - Single test log file (default: `dist/test-single.log`)
  - `$TEST_SINGLE_ERROR_PATTERN` - Single test error regex (default: same as all tests)
  - `$LOG_DIR` - Log directory (default: `dist`)
  - `$TEST_FILE` - Test file argument from command (from `$1`)

## 2. Build Project

→ Create log directory: `mkdir -p "$LOG_DIR"`
→ Run build silently: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
→ Check exit code

✓ Build succeeded (exit 0)
  → Proceed to step 3

✗ Build failed (exit non-zero)
  → Extract errors: `grep -E "$BUILD_ERROR_PATTERN" "$BUILD_LOG" | head -20 || echo "No errors matched pattern"`
  → Display: "❌ Build failed:" + errors
  → Display: "📁 Full log: $BUILD_LOG"
  → Ask user via AskUserQuestion: "Build failed. Should I analyze and fix the build issues?"
    - "Yes" (recommended) → Analyze and fix, return to step 2
    - "No, I'll fix manually" → Stop, user will fix
    - "Other" → Follow custom instruction

## 3. Run Tests

→ Determine test command based on mode:
  - Single test mode: Replace `{testFile}` placeholder in `$TEST_SINGLE_CMD` with `$TEST_FILE`
    - `ACTUAL_CMD=$(echo "$TEST_SINGLE_CMD" | sed "s|{testFile}|${TEST_FILE}|g")`
    - `ACTUAL_LOG="$TEST_SINGLE_LOG"`
    - `ACTUAL_PATTERN="$TEST_SINGLE_ERROR_PATTERN"`
  - All tests mode:
    - `ACTUAL_CMD="$TEST_CMD"`
    - `ACTUAL_LOG="$TEST_LOG"`
    - `ACTUAL_PATTERN="$TEST_ERROR_PATTERN"`

→ Display: "🧪 Running tests..." + (single test mode: " (${TEST_FILE})" or all tests mode: " (all tests)")
→ Run tests silently: `$ACTUAL_CMD > "$ACTUAL_LOG" 2>&1`
→ Check exit code

✓ Tests passed (exit 0)
  → Proceed to step 9

✗ Tests failed (exit non-zero)
  → Proceed to step 4

## 4. Extract Errors

→ Extract errors: `grep -E "$ACTUAL_PATTERN" "$ACTUAL_LOG" | head -30 || echo "No errors matched pattern"`
→ Count errors: `ERROR_COUNT=$(grep -cE "$ACTUAL_PATTERN" "$ACTUAL_LOG" || echo "0")`
→ Display: "❌ Tests failed: $ERROR_COUNT errors found"
→ Display: First 30 matching lines
→ Display: "📁 Full log: $ACTUAL_LOG"
→ Proceed to step 5

## 5. Analyze Failures and Create Fix Plan

→ Analyze test failures to identify distinct failing tests
→ For each failing test, determine:
  - Test name/description
  - Root cause of failure
  - Files that need modification
→ Use TodoWrite to create todo list with:
  - One todo per failing test
  - content: "Fix test: [test name]"
  - activeForm: "Fixing test: [test name]"
  - status: "pending" for all tests
→ Display: "📋 Created fix plan for N failing tests"
→ Proceed to step 6

## 6. Ask to Start Fixing

→ Use AskUserQuestion with options:
  - Question: "Start fixing tests one by one?"
  - "Yes" (recommended) → Proceed to step 7
  - "No, I'll fix manually" → Stop, user will fix
  - "Other" → Follow custom instruction

✓ User chose "Yes" → Proceed to step 7
✗ User chose "No, I'll fix manually" → Stop
→ User chose "Other" → Follow their custom instruction

## 7. Fix Next Test

→ Get next pending test from todo list
→ Mark current test as "in_progress" using TodoWrite
→ Display: "🔧 Fixing: [test name]"
→ Identify and display files to modify
→ Fix issues: modify relevant code files
→ Mark current test as "completed" using TodoWrite
→ Proceed to step 8

## 8. Ask Next Action

→ Count remaining pending tests in todo list
→ Use AskUserQuestion with options:
  - Question: "Test fixed! What next? (N tests remaining)"
  - "Fix next test" (recommended if tests remain) → Return to step 7
  - "Re-run all tests" → Clear todo list, return to step 3
  - "Stop for now" → Stop, preserve todo list
  - "Other" → Follow custom instruction

✓ User chose "Fix next test" AND tests remain → Return to step 7
✓ User chose "Fix next test" AND no tests remain → Display "All tests fixed!", return to step 3
✓ User chose "Re-run all tests" → Clear todos with TodoWrite, return to step 3
✗ User chose "Stop for now" → Stop
→ User chose "Other" → Follow their custom instruction

## 9. Success

✅ All tests passed
✅ Build complete
→ Clear any remaining todos with TodoWrite (empty list)
→ Display: "✅ Success! Build and tests passed"
→ Display: "📁 Build log: $BUILD_LOG"
→ Display: "📁 Test log: $ACTUAL_LOG"
✓ Done

🔧 Configuration: `.claude/build-config.json` (optional project override)
📁 Default logs: `dist/build.log`, `dist/test.log`, `dist/test-single.log`
