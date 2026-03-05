# Instructions: Extract Build Errors

Follow these instructions to extract errors from build logs:

## Procedure

→ Execute build error parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-build-errors.js"
```

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output from script execution.
  - → Extract `totalErrors` count
  - → Invoke the `broken-build-analyzer` agent, passing it TWO inputs:
    1. Pre-parsed errors JSON (script output)
    2. Project configuration JSON (from step 2 of skill workflow)
  - → Receive structured JSON containing analysis from the agent
  - → Resume skill workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Analyze the error and either recover or halt the workflow
  - → Resume skill workflow with error context

