# Extract Test Failures

Execute the test failure parsing script to extract failure information from test results.

## Procedure

→ Execute test failure parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-test-failures.js"
```

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output
  - → Extract `totalFailures` count

  - → If `totalFailures` = 0:
    - → Display to user: "All tests passed"
    - → Return to skill workflow with "no failures" indication

  - → If `totalFailures` > 0:
    - → Display count to user: "Found [totalFailures] test failures"
    - → Pass script output to failed-test-analyzer agent
    - → Resume workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Detect the issue (missing results file, invalid config, etc.) and recover or halt
  - → Resume skill workflow with error context

**IMPORTANT:** Script handles all parsing logic. Pass its JSON output directly to the analyzer agent - the agent interprets the self-documenting structure.
