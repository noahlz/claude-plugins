# Instructions: Execute Test Suite

Follow these instructions to run the project tests:

**Contents:**
- Prerequisites
- Test Execution
  - All Tests Mode
  - Single Test Mode
- Exit Code Handling

---

## Prerequisites

You should have:
- JSON configuration loaded from step 2
- A successful build (or skipped if `config.skipBuild=true`)

**If either are missing, do not improvise. Tell the user and exit the workflow immediately**.

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
→ Wrap the command in a subshell and redirect output to `config.test.all.resultsPath`  
→ Using a subshell `(command)` ensures the redirect applies only to the test runner process, not to any surrounding shell constructs  

⚠️ **Note**: If the test command uses `-- <args>` to pass flags to an underlying tool (e.g., `npm test -- --reporter=tap`), those flags may not reach the tool if it is wrapped in a shell script. In that case, prefer setting `nativeOutputSupport=true` and embedding the output flag directly in the command (e.g., `vitest run --reporter=tap --outputFile=dist/test-results.tap`).

Example bash command:
```bash
(npm test) > dist/test-results.tap 2>&1
```

### Single Test Mode

→ Check if running a specific test file  
→ Use `config.test.single.command` with {testFile} replaced  
→ Check `config.test.single.nativeOutputSupport` flag:  

**If `config.test.single.nativeOutputSupport=true`:**  
→ Execute command WITHOUT stdout/stderr redirection

**If `config.test.single.nativeOutputSupport=false`:**  
→ Wrap the command in a subshell and redirect output to `config.test.single.resultsPath`  

Example bash command with native output support:
```bash
npm --silent test -- path/to/test.js
```

## Exit Code Handling

→ Execute test command and capture exit code:  
✓ Exit 0 → All tests pass, inform the user and Exit Workflow.  
✗ Exit non-zero → Tests failed, return to step 5 (Extract Test Failures)   
