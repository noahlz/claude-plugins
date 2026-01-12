# Build and Test Failure Extraction 

Contents:
- Extracting build errors.
- Extracting test failures.

## EXTRACT_BUILD_ERRORS

Procedure to extract compilation errors from build log:

→ Try to get language diagnostics from editor using available IDE MCP or LSP tools  
✓ MCP or LSP tool available → Extract errors with precise locations  
✗ Not available → Parse build logs using `config.build.errorPattern` regex  

→ Per the failed build defined by `config.build`:
  - Read log file at `config.build.logFile`
  - Extract errors using `config.build.errorPattern` regex

→ Extract up to 30 distinct compilation errors with:
  - File paths
  - Line numbers and column positions (if available)
  - Error messages and error codes

→ Display compilation error summary to user

## EXTRACT_TEST_FAILURE

Procedure to extract failures from test results:

→ Parse test results at `config.test.all.resultsPath` to identify failing tests  
→ Extract error patterns from results using `config.test.all.errorPattern` regex  
→ Identify failing tests (up to 30 distinct failures)  

✓ 0 failures detected → No errors to extract  
✗ 1-30 failures → Extract with test names, error messages, stack traces  
✗ 30+ failures → Display count warning  

→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)
