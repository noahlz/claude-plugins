---
name: run-and-fix-tests
description: Run tests with clean output and fix any failures
---

# Skill: Run and Fix Tests

Run tests with clean output, showing only errors. If tests fail, analyze and fix them.

## Process

1. **Run tests silently** and capture output:
```bash
npm test > .logs/test.log 2>&1
```

2. **Check exit code**:
   - If successful: Report "✅ Tests passed"
   - If failed: Extract and show errors

3. **Extract errors** (if failed):
```bash
grep -E "(FAIL|●|Error:)" .logs/test.log | head -20
```

4. **Analyze failures** and identify root causes

5. **Fix the issues** by modifying the relevant code

6. **Re-run tests** to verify fixes

7. **Repeat** until all tests pass

## Output

All tests passing, with minimal console output showing only the final status.
