# Run Tests Procedure

## Prerequisites

- Configuration values loaded from Section 2
- Build completed (or skipped if SKIP_BUILD=true)

---

## Test Execution

### Single Test Mode

→ Check if running a specific test file

→ Use TEST_SINGLE_CMD value with {testFile} replaced

→ Check TEST_SINGLE_NATIVE_OUTPUT flag:

**If TEST_SINGLE_NATIVE_OUTPUT=true:**
→ Execute command WITHOUT stdout/stderr redirection

**If TEST_SINGLE_NATIVE_OUTPUT=false:**
→ Redirect output to TEST_SINGLE_RESULTS_PATH

Example bash command using literal values:
```bash
npm test -- path/to/test.js > dist/test-single-results.tap 2>&1
```

### All Tests Mode (Default)

→ Use TEST_CMD value (captured literal from Section 2, e.g., "npm test")

→ Use TEST_RESULTS_PATH value (e.g., "dist/test-results.tap")

→ Check TEST_NATIVE_OUTPUT flag:

**If TEST_NATIVE_OUTPUT=true:**  
→ Tool natively supports file output (e.g., Maven's `--log-file`, npm's `--test-reporter-destination`)  
→ Execute command WITHOUT stdout/stderr redirection  

Example bash command:
```bash
npm test --silent -- --test-reporter=tap --test-reporter-destination=dist/test-results.tap
```

**If TEST_NATIVE_OUTPUT=false:**  
→ Tool requires stdout/stderr redirection  
→ Redirect output to TEST_RESULTS_PATH  

Example bash command:
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
