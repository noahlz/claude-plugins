# Extract Build Errors

## Procedure

→ Read the build log file. Determine the build tool format (maven, gradle, tsc, gcc, cargo, go, generic).

→ Run the build error parser:
```
node "<SKILL_BASE_DIR>/scripts/parse-build-errors.js" --file dist/build.log --format <format>
```

(Use `--pattern "<regex>"` instead of `--format` if the built-in formats don't match.)

→ Check exit code:

→ If exit code = 0 (success):
  - → Parse JSON output from script execution
  - → Extract `totalErrors` count
  - → Invoke the `broken-build-analyzer` agent, passing it:
    1. Pre-parsed errors JSON (script output)
    2. The build log file path (for reading more context if needed)
  - → Receive analysis from the agent
  - → Resume skill workflow with agent analysis

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Analyze the error and either recover or halt the workflow
  - → Resume skill workflow with error context
