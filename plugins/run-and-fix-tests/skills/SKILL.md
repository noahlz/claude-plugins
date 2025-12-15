---
description: Build project and run tests with clean output, fix any failures
capabilities:
  - Load build and test configuration
  - Build project silently
  - Run tests silently with error extraction
  - Analyze and fix test failures
  - Iterate until all tests pass
---

Activate when user says "run tests", "test", "build and test", "fix tests", or "make test". Build project and run tests silently. Extract errors if tests fail, analyze failures, fix code, and repeat until all tests pass.

## 1. Load Configuration

🔧 Load build/test config:
→ Run `CONFIG=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/load-build-config.js)`
→ Extract values: `BUILD_CMD`, `BUILD_LOG`, `TEST_CMD`, `TEST_LOG`, `TEST_ERROR_PATTERN`
✓ Config loaded and placeholders resolved

## 2. Build Project

→ Create log directory if needed: `mkdir -p "$(dirname "$BUILD_LOG")"`
→ Run build silently: `$BUILD_CMD > "$BUILD_LOG" 2>&1`
→ Check exit code

✓ Build succeeded (exit 0)
  → Proceed to step 3

✗ Build failed (exit non-zero)
  → Extract errors: `grep -E "$BUILD_ERROR_PATTERN" "$BUILD_LOG" | head -20`
  → Display: "❌ Build failed:" + errors
  → Display: "📁 Full log: $BUILD_LOG"
  → Analyze and fix build issues
  → Return to step 2

## 3. Run Tests

→ Run tests silently: `$TEST_CMD > "$TEST_LOG" 2>&1`
→ Check exit code

✓ Tests passed (exit 0)
  → Display: "✅ All tests passed"
  → Done

✗ Tests failed (exit non-zero)
  → Proceed to step 4

## 4. Extract & Fix Errors

→ Extract errors: `grep -E "$TEST_ERROR_PATTERN" "$TEST_LOG" | head -30`
→ Display: "❌ Tests failed:" + errors
→ Display: "📁 Full log: $TEST_LOG"
→ Analyze failures to identify root causes
→ Fix issues: modify relevant code files
→ Return to step 3

⚠ Repeat steps 3-4 until all tests pass

## 5. Success

✓ All tests passing
✓ Build complete
✓ Done

🔧 Configuration: `.claude/build-config.json` (optional project override)
📁 Default logs: `dist/build.log`, `dist/test.log`
