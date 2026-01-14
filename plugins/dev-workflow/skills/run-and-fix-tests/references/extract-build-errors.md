# Extract Build Errors

Execute the build error parsing script to extract error information from build logs.

## Procedure

→ Execute build error parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-build-errors.js"
```

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output (pre-parsed errors structure)
  - → Extract `totalErrors` count
  - → Invoke broken-build-analyzer agent with TWO inputs:
    1. Pre-parsed errors JSON (script output)
    2. Project configuration JSON (from step 2 of skill workflow)
  - → Receive structured analysis per agent's Output Format (see ../../agents/broken-build-analyzer.md)
  - → Resume skill workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Analyze the error and either recover or halt the workflow
  - → Resume skill workflow with error context

**IMPORTANT:** Script handles all parsing logic. Pass its JSON output directly to the analyzer agent - the agent interprets the self-documenting structure.
