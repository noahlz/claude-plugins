# Build and Test Procedures

Common procedures for extracting errors and rebuilding/testing projects.

## EXTRACT_BUILD_ERRORS

Procedure to extract compilation errors from build log:

→ Try to get language diagnostics from editor using available IDE MCP or LSP tools  
✓ MCP or LSP tool available → Extract errors with precise locations  
✗ Not available → Parse build logs using config.build[].errorPattern regex  

→ For each failed build in config.build:
  - Read log file at config.build[i].logFile
  - Extract errors using config.build[i].errorPattern regex

→ Extract up to 30 distinct compilation errors with:
  - File paths
  - Line numbers and column positions (if available)
  - Error messages and error codes

→ Display compilation error summary to user

## REBUILD_AND_VERIFY

Procedure to rebuild project and verify compilation:

→ Iterate through each build in config.build:
  - For each build, check build.nativeOutputSupport flag:

    **If build.nativeOutputSupport=true:**
    - Tool natively supports file output, execute WITHOUT redirection:
    - `cd "{build.workingDir}" && {build.command}`

    **If build.nativeOutputSupport=false:**
    - Tool requires stdout/stderr redirection:
    - `cd "{build.workingDir}" && {build.command} > "{build.logFile}" 2>&1`

  - Track exit codes for each build step

→ After all builds complete:
  - Exit 0 (all succeeded) → Return to original directory, build succeeded
  - Exit non-zero (any failed) → Return to original directory, check logs for errors

## EXTRACT_TEST_ERRORS

Procedure to extract test failures from test results:

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
