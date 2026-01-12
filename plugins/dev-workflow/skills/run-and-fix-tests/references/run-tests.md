# Run Tests Procedure

## Prerequisites

- Configuration values loaded from step 2 (parsed JSON config)
- Build completed (or skipped if `config.skipBuild=true`)

Contents:

- Test Execution: All Tests Mode
- Test Execution: Single Test Mode
- Exit Code Handling

---

## Test Execution

### All Tests Mode

→ Use `config.test.all.command` (e.g., "npm test")  
→ Use `config.test.all.resultsPath` (e.g., "dist/test-results.tap")  
→ Check `config.test.all.nativeOutputSupport` flag:  

**If `config.test.all.nativeOutputSupport=true`:**  
→ Tool natively supports file output (e.g., Maven's `--log-file`, npm's `--test-reporter-destination`)  
→ Execute command WITHOUT stdout/stderr redirection  

Example bash command:
```bash
npm test --silent -- --test-reporter=tap --test-reporter-destination=dist/test-results.tap
```

**If `config.test.all.nativeOutputSupport=false`:**  
→ Tool requires stdout/stderr redirection  
→ Redirect output to `config.test.all.resultsPath`  

Example bash command:
```bash
npm test > dist/test-results.tap 2>&1
```

### Single Test Mode

→ Check if running a specific test file  
→ Use `config.test.single.command` with {testFile} replaced  
→ Check `config.test.single.nativeOutputSupport` flag:  

**If `config.test.single.nativeOutputSupport=true`:**  
→ Execute command WITHOUT stdout/stderr redirection

**If `config.test.single.nativeOutputSupport=false`:**  
→ Redirect output to `config.test.single.resultsPath`

Example bash command with native output support:
```bash
npm --silent test -- path/to/test.js
```


## Exit Code Handling

→ Execute test command and capture exit code:  
✓ Exit 0 → All tests pass, inform the user and Exit Workflow. 
✗ Exit non-zero → Tests failed, return to step 5 (Extract Test Errors)  
