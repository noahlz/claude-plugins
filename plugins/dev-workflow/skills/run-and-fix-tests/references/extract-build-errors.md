# Extract Build Errors

Execute the build error parsing script to extract error information from build logs.

## Procedure

→ Execute build error parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-build-errors.js"
```

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output
  - → Extract `totalErrors` count
  - → Pass script output to broken-build-analyzer agent
  - → Resume skill workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Analyze the error and either recover or halt the workflow
  - → Resume skill workflow with error context

**IMPORTANT:** Script handles all parsing logic. Pass its JSON output directly to the analyzer agent - the agent interprets the self-documenting structure.
