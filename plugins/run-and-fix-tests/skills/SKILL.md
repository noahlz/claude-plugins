---
name: run-and-fix-tests
description: Build project and run tests with clean output, fix any failures. Activate when user says "run tests", "test", "build and test", "fix tests", or "make test".
---

## 1. Load Configuration

→ Run: `source ${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh`
→ Use in subsequent steps:
  - `$BUILD_CMD` - Build command (default: `npm run build`)
  - `$BUILD_LOG` - Build log file (default: `dist/build.log`)
  - `$BUILD_ERROR_PATTERN` - Build error regex (default: `(error|Error|✘)`)
  - `$TEST_CMD` - Test command (default: `npm test`)
  - `$TEST_LOG` - Test log file (default: `dist/test.log`)
  - `$TEST_ERROR_PATTERN` - Test error regex (default: `(FAIL|●|Error:|Expected|Received)`)
✓ Configuration loaded and merged

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

## 4. Extract Errors

→ Extract errors: `grep -E "$TEST_ERROR_PATTERN" "$TEST_LOG" | head -30`
→ Display: "❌ Tests failed:" + errors
→ Display: "📁 Full log: $TEST_LOG"

## 5. Ask to Fix

→ Use AskUserQuestion with options:
  - "Yes" (recommended) → Proceed to step 6
  - "No, I'll fix manually" → Stop, user will fix
  - "Other" → User provides custom instruction

✓ User chose "Yes" → Proceed to step 6
✗ User chose "No, I'll fix manually" → Done, wait for user
→ User chose "Other" → Follow their custom instruction

## 6. Fix Issues

→ Analyze failures to identify root causes
→ Fix issues: modify relevant code files
→ Return to step 3

⚠ Repeat steps 3-6 until all tests pass

## 7. Success

✓ All tests passing
✓ Build complete
✓ Done

🔧 Configuration: `.claude/build-config.json` (optional project override)
📁 Default logs: `dist/build.log`, `dist/test.log`
