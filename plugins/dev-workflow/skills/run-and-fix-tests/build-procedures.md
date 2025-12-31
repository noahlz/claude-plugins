# Build and Test Procedures

Common procedures for extracting errors and rebuilding/testing projects.

## EXTRACT_BUILD_ERRORS

Procedure to extract compilation errors from build log:

→ Try to get language diagnostics from editor using available IDE MCP or LSP tools  
✓ MCP or LSP tool available → Extract errors with precise locations  
✗ Not available → Parse build log at `$BUILD_LOG` using `$BUILD_ERROR_PATTERN` regex  

→ Extract up to 30 distinct compilation errors with:
  - File paths
  - Line numbers and column positions (if available)
  - Error messages and error codes

→ Display compilation error summary to user

## REBUILD_AND_VERIFY

Procedure to rebuild project and verify compilation:

→ Iterate through all builds by index (0 to BUILD_COUNT-1):
  - For each i: `cd "${BUILD_${i}_WORKING_DIR}" && ${BUILD_${i}_CMD} > "${BUILD_${i}_LOG}" 2>&1`
  - Track exit codes for each build step

→ After all builds complete:
  - Exit 0 (all succeeded) → Return to INITIAL_PWD, build succeeded
  - Exit non-zero (any failed) → Return to INITIAL_PWD, check logs for errors

## EXTRACT_TEST_ERRORS

Procedure to extract test failures from test results:

→ Parse test results at `$TEST_RESULTS_PATH` to identify failing tests  
→ Extract error patterns from results using `$TEST_ERROR_PATTERN` regex  
→ Identify failing tests (up to 30 distinct failures)  

✓ 0 failures detected → No errors to extract  
✗ 1-30 failures → Extract with test names, error messages, stack traces  
✗ 30+ failures → Display count warning  

→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)
