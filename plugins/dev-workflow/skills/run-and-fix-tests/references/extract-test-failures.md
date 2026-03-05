# Instructions: Extract Test Failures

Follow these instructions to extract failure information from test results:

## Procedure

→ Execute test failure parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-test-failures.js"
```

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output from script execution
  - → Extract `totalFailures` count and `warning` field (if present)

  - → If `totalFailures` = 0 AND test command exit code (from step 4) was 0:
    - → Display to user: "All tests passed"
    - → Return to skill workflow with "no failures" indication

  - → If `totalFailures` = 0 AND test command exit code (from step 4) was non-zero:
    - ⚠️ **Format mismatch detected**: parser found 0 failures but tests exited with a failure code
    - → Warn user: "Parser found 0 failures but exit code indicates test failures. The output format may not match the configured errorPattern."
    - → If `warning` field is present in JSON output, display it to the user
    - → Read the raw results file at `config.test.all.resultsPath` using the Read tool
    - → Invoke the `failed-test-analyzer` agent, passing it TWO inputs:
      1. Raw results file contents
      2. Project configuration JSON (from step 2 of skill workflow)
    - → Receive structured JSON analysis from the agent
    - → Resume workflow with agent analysis

  - → If `totalFailures` > 0:
    - → Display count to user: "Found [totalFailures] test failures"
    - → Invoke the `failed-test-analyzer` agent, passing it TWO inputs:
      1. Pre-parsed failures JSON (script output)
      2. Project configuration JSON (from step 2 of skill workflow)
    - → Receive structured JSON analysis from the agent
    - → Resume workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Detect the issue (missing results file, invalid config, etc.) and recover or halt
  - → Resume skill workflow with error context
