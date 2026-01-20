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
  - → Extract `totalFailures` count

  - → If `totalFailures` = 0:
    - → Display to user: "All tests passed"
    - → Return to skill workflow with "no failures" indication

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
