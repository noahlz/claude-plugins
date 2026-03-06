# Extract Test Failures

## Procedure

→ Use the JSON output from `parse-test-failures.js` (run in step 4b).

→ Check the JSON output:

→ If `totalFailures` = 0 AND test command exit code was 0:
  - → Display to user: "All tests passed"
  - → Return to skill workflow with "no failures" indication

→ If `totalFailures` = 0 AND test command exit code was non-zero:
  - → Warn user: "Parser found 0 failures but exit code indicates failures. Output format may not match."
  - → If `warning` field is present in JSON output, display it to the user
  - → Read the raw output file using the Read tool
  - → Invoke the `failed-test-analyzer` agent, passing it:
    1. Raw output file contents
    2. The output file path
  - → Receive analysis from the agent
  - → Resume workflow with agent analysis

→ If `totalFailures` > 0:
  - → Display count to user: "Found [totalFailures] test failures"
  - → Invoke the `failed-test-analyzer` agent, passing it:
    1. Pre-parsed failures JSON (script output)
    2. The output file path (for reading more context if needed)
  - → Receive analysis from the agent
  - → Resume workflow with agent analysis

→ If `parse-test-failures.js` exited non-zero:
  - → Display error message to user
  - → Detect the issue (missing output file, invalid pattern, etc.) and recover or halt
  - → Resume skill workflow with error context
