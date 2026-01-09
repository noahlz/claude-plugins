# Run Tests Procedure

## Prerequisites

- Configuration values loaded from Section 2
- Build completed (or skipped if SKIP_BUILD=true)

---

## Test Execution

### Single Test Mode

→ Check if running a specific test file

→ Use TEST_SINGLE_CMD value with {testFile} replaced

→ Redirect output to TEST_SINGLE_RESULTS_PATH

Example bash command using literal values:
```bash
npm test -- path/to/test.js > dist/test-single-results.tap 2>&1
```

### All Tests Mode (Default)

→ Use TEST_CMD value (captured literal from Section 2, e.g., "npm test")

→ Redirect output to TEST_RESULTS_PATH value (e.g., "dist/test-results.tap")

→ Optionally capture human-readable output to TEST_LOG value (e.g., "dist/test.log")

Example bash command using literal values:
```bash
npm test > dist/test-results.tap 2>&1
```

## Exit Code Handling

→ Execute test command and capture exit code

✓ Exit 0 → All tests pass, return to SKILL.md Section 8 (Completion)

✗ Exit non-zero → Tests failed, return to SKILL.md Section 5 (Extract Test Errors)

## VERIFY Checklist

- [ ] Used literal values from Section 2 (not shell variables like `$TEST_CMD`)
- [ ] Output redirected to file path (not printed to console)
- [ ] Exit code captured and checked
- [ ] Followed conditional routing based on exit code
