# Agent Delegation Procedures

Common procedures for delegating work to and resuming sub-agents (build-fixer, test-fixer).

## BUILD_FIXER_ENV_VARS

Environment variables to provide when delegating to build-fixer agent:
- `BUILD_COUNT` - number of build steps (e.g., "1" or "2")
- `BUILD_{i}_CMD` - actual command for step i (e.g., "npm run build")
- `BUILD_{i}_LOG` - actual log path for step i (e.g., "dist/npm-build.log")
- `BUILD_{i}_ERROR_PATTERN` - actual pattern for step i (e.g., "(error|Error|ERR!)")
- `BUILD_{i}_WORKING_DIR` - actual path for step i (e.g., ".")
- `OUT_DIR` - actual path (e.g., "dist/")
- `INITIAL_PWD` - actual path (e.g., "/current/working/directory")
- `SKIP_BUILD` - "true" or "false" (whether build step was skipped)

## TEST_FIXER_ENV_VARS

Environment variables to provide when delegating to test-fixer agent:
- All BUILD_FIXER_ENV_VARS (above) for compilation checking, including `SKIP_BUILD`
- `TEST_CMD` - actual value (e.g., "npm test")
- `TEST_RESULTS_PATH` - actual path to test results file (e.g., "dist/test-results.tap")
- `TEST_SINGLE_CMD` - actual value (e.g., "npm test -- {testFile}")
- `TEST_SINGLE_RESULTS_PATH` - actual path to single test results file (e.g., "dist/test-single-results.tap")
- `TEST_LOG` - optional path to human-readable log file (e.g., "dist/test.log")

## DELEGATE_TO_BUILD_FIXER

Procedure to delegate to build-fixer agent:

→ Delegate to the `build-fixer` agent to fix compilation errors one-by-one.

→ Provide agent with context in natural language:
  - Build error list: [bulleted list with file:line:col and error messages]
  - Example error entry: "src/auth.ts:45:12 - TS2304: Cannot find name 'User'"

→ Provide BUILD_FIXER_ENV_VARS (see above)

→ Agent fixes the errors per its instructions and context provided.

## RESUME_TEST_FIXER

Procedure to delegate back to the test-fixer agent after build-fixer completes:

→ Delegate back to the test-fixer agent using Task tool with resume parameter:
  - `resume: $TEST_FIXER_AGENT_ID`
  - `prompt: "Compilation errors have been resolved by build-fixer. BUILD_LOG shows clean build. Continue with test fix verification."`

→ Test-fixer continues from where it left off (re-runs verification starting with compilation check)
