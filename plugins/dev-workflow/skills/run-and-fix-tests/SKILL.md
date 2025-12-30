---
name: run-and-fix-tests
description: Build the project, run tests and systematically fix any failures. Activate when user says: "run tests", "run the tests", "test this/it/the changes", "execute tests", "build and test", "fix tests", "make sure tests pass", "verify with tests", "check if tests work/pass", "verify the fix/changes", "see if this/it works", "check that/if it works", OR when user mentions "failing/failed tests", "test failures", "CI failing", "GitHub Actions failing", "tests not passing", OR after making code changes to verify they work, OR when tests are the logical next development step.
---

This skill streamlines running and fixing unit tests in a project. It:
- resolves the project build/test commands from project-specific configuration, generating it for future use (with user input), if needed.
- strives for minimal token / context usage by redirecting build/test output to files
- Uses specialized sub-agents to preserve main task context when fixing compilation and test breaks.

Activate this skill proactively after making code changes to verify they work (suggest first: "Should I run the test suite to verify these changes?").

Also activate this skill when the user requests testing using phrases like:
- "run tests"
- "test the changes"
- "build and test"
- "fix failing tests"

## 0. Resolve Plugin Root

→ Resolve plugin root environment (check local project first, then user home):
```bash
RESOLVER=""
if [ -x "./.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="./.claude/resolve_plugin_root.sh"
elif [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then
  RESOLVER="$HOME/.claude/resolve_plugin_root.sh"
else
  echo "Error: resolve_plugin_root.sh not found in ./.claude/ or $HOME/.claude/" >&2
  exit 1
fi
CLAUDE_PLUGIN_ROOT="$($RESOLVER "dev-workflow@noahlz.github.io")" || { echo "Error: Failed to resolve plugin root" >&2; exit 1; }
export CLAUDE_PLUGIN_ROOT
```

✓ Plugin root resolved → Proceed to step 0a (Check Node.js)

## 0a. Check Node.js Installation

Execute the steps in `${CLAUDE_PLUGIN_ROOT}/common/check-node.md` to determin if node 18+ is available.

## 1. Detect Build Configuration

→ Check if `.claude/settings.plugins.run-and-fix-tests.json` exists  
✓ Config exists → Proceed to step 2  
✗ Config missing → Run detection and auto-config:  

→ Execute: `node ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.js "${CLAUDE_PLUGIN_ROOT}"`
  - Scans project for build tool config files (package.json, pom.xml, build.gradle, etc.)
  - Detects which tools are present
  - Outputs JSON array of detected tools with configurations

→ Auto-selection rules:
  - Exactly 1 tool detected → Use `defaults/{tool}.json`
  - Multiple tools in different locations → Generate polyglot config (🔧 shown to user)
  - Multiple tools in same location → Generate polyglot config
  - No matching default exists → Use `TEMPLATE.json` placeholder template (user must customize)
  - 0 tools detected → Error: no build tools detected

✓ Config created successfully → Proceed to step 2  
✗ No tools detected → Error, user must create `.claude/settings.plugins.run-and-fix-tests.json` manually  
✗ Using placeholder config → User must edit `.claude/settings.plugins.run-and-fix-tests.json` before step 2  

## 2. Load Configuration

→ Execute load-config script to output configuration as eval-able statements:
```bash
eval "$(node ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.js "${CLAUDE_PLUGIN_ROOT}")"
```
✗ Script fails → Display error and stop  
✓ Script succeeds → Environment variables set:
  - BUILD_COUNT, BUILD_{i}_CMD, BUILD_{i}_LOG, BUILD_{i}_ERROR_PATTERN, BUILD_{i}_WORKING_DIR (for each build step)
  - TEST_CMD, TEST_LOG, TEST_ERROR_PATTERN
  - TEST_SINGLE_CMD, TEST_SINGLE_LOG, TEST_SINGLE_ERROR_PATTERN
  - LOG_DIR (tool-specific, e.g., dist/, build/, target/)

→ Check command argument: `TEST_FILE="$1"`
→ Determine mode:
  - `$TEST_FILE` not empty → Single test mode
  - `$TEST_FILE` empty → All tests mode

→ Store initial working directory: `INITIAL_PWD=$(pwd)`

→ Determine build count: `BUILD_COUNT=$BUILD_COUNT` (number of indexed build steps)

## Common Definitions

### BUILD_FIXER_ENV_VARS

Environment variables to provide when delegating to build-fixer agent:
- `CLAUDE_PLUGIN_ROOT` - actual path (e.g., "/Users/user/.claude/plugins/dev-workflow@noahlz.github.io")
- `BUILD_COUNT` - number of build steps (e.g., "1" or "2")
- `BUILD_{i}_CMD` - actual command for step i (e.g., "npm run build")
- `BUILD_{i}_LOG` - actual log path for step i (e.g., "dist/npm-build.log")
- `BUILD_{i}_ERROR_PATTERN` - actual pattern for step i (e.g., "(error|Error|ERR!)")
- `BUILD_{i}_WORKING_DIR` - actual path for step i (e.g., ".")
- `LOG_DIR` - actual path (e.g., "dist/")
- `INITIAL_PWD` - actual path (e.g., "/current/working/directory")
- `SKIP_BUILD` - "true" or "false" (whether build step was skipped)

### TEST_FIXER_ENV_VARS

Environment variables to provide when delegating to test-fixer agent:
- BUILD_FIXER_ENV_VARS (see above) for compilation checking, including `SKIP_BUILD`
- `TEST_SINGLE_CMD` - actual value (e.g., "npm test --testNamePattern={testName}")
- `TEST_SINGLE_LOG` - actual path (e.g., "logs/test-single.log")

### EXTRACT_BUILD_ERRORS

Procedure to extract compilation errors from build log:

→ Try to get language diagnostics from editor using available IDE MCP or LSP tools  
✓ MCP or LSP tool available → Extract errors with precise locations  
✗ Not available → Parse build log at `$BUILD_LOG` using `$BUILD_ERROR_PATTERN` regex  

→ Extract up to 30 distinct compilation errors with:
  - File paths
  - Line numbers and column positions (if available)
  - Error messages and error codes

→ Display compilation error summary to user

### DELEGATE_TO_BUILD_FIXER

Procedure to delegate to build-fixer agent:

→ Use the `build-fixer` agent to fix compilation errors one-by-one.

→ Provide agent with context in natural language:
  - Build error list: [bulleted list with file:line:col and error messages]
  - Example error entry: "src/auth.ts:45:12 - TS2304: Cannot find name 'User'"

→ Provide BUILD_FIXER_ENV_VARS (see above)

→ Agent fixes the errors per its instructions and context provided.

### REBUILD_AND_VERIFY

Procedure to rebuild project and verify compilation:

→ Iterate through all builds by index (0 to BUILD_COUNT-1):
  - For each i: `cd "${BUILD_${i}_WORKING_DIR}" && ${BUILD_${i}_CMD} > "${BUILD_${i}_LOG}" 2>&1`
  - Track exit codes for each build step

→ After all builds complete:
  - Exit 0 (all succeeded) → Return to INITIAL_PWD, build succeeded
  - Exit non-zero (any failed) → Return to INITIAL_PWD, check logs for errors

### RESUME_TEST_FIXER

Procedure to resume test-fixer agent after build-fixer completes:

→ Resume test-fixer agent using Task tool with resume parameter:
  - `resume: $TEST_FIXER_AGENT_ID`
  - `prompt: "Compilation errors have been resolved by build-fixer. BUILD_LOG shows clean build. Continue with test fix verification."`

→ Test-fixer continues from where it left off (re-runs verification starting with compilation check)

## 3. Build Project

→ Check if build should be skipped: `$SKIP_BUILD`

**Skip Build (SKIP_BUILD=true):**
→ Display: "Build step skipped (build command identical to test command)"
→ Proceed directly to step 4 (Run Tests)

**Run Build (SKIP_BUILD=false):**
→ Create log directory: `mkdir -p "$LOG_DIR"`
→ Iterate through all builds by index:
  → For each index i from 0 to (BUILD_COUNT - 1):
    - Extract variables: BUILD_${i}_CMD, BUILD_${i}_LOG, BUILD_${i}_WORKING_DIR, BUILD_${i}_ERROR_PATTERN
    - Change to working directory: `cd "${BUILD_${i}_WORKING_DIR}"`
    - Execute build command: `${BUILD_${i}_CMD} > "${BUILD_${i}_LOG}" 2>&1`
    - Check exit code:
      - Exit 0: continue to next build
      - Exit non-zero: record failure, continue collecting all errors

→ When builds fail:
  - Collect error logs from all failed builds
  - Parse each log using its specific BUILD_${i}_ERROR_PATTERN
  - Return to INITIAL_PWD, proceed to step 3a with aggregated error list

✓ All builds succeed → Return to INITIAL_PWD, proceed to step 4 (Run Tests)

## 3a. Extract Build Errors

→ Extract errors (see EXTRACT_BUILD_ERRORS)

→ Use AskUserQuestion: "Build failed with [N] compilation errors. Fix them?"
  - "Yes" → Proceed to step 3b
  - "No" → Stop

## 3b. Delegate to Build-Fixer Agent

→ Delegate to build-fixer with error list from step 3a (see DELEGATE_TO_BUILD_FIXER)

✓ Agent completes → Proceed to step 3c

## 3c. Rebuild After Fixes

→ Return to step 3 (Build Project) to verify fixes

## 4. Run Tests

→ Determine test command based on mode:
  - Single test mode: TEST_CMD = `$TEST_SINGLE_CMD` with {testFile} replaced
  - All tests mode: TEST_CMD = `$TEST_CMD`

→ Change to test working directory (if different from build dir)  
→ Execute test command silently to log file: `$TEST_CMD > "$TEST_LOG" 2>&1`  
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to step 8 (Completion)  
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to step 5 (Extract Test Errors)  

## 5. Extract Test Errors

→ Parse test log at `$TEST_LOG` to identify failing tests  
→ Extract error patterns from log using `$TEST_ERROR_PATTERN` regex  
→ Identify failing tests (up to 30 distinct failures)  

✓ 0 failures detected → Proceed to step 8 (Completion)  
✗ 1-30 failures → Display error summary, proceed to step 6  
✗ 30+ failures → Display count, proceed to step 6  

→ Display error summary to user with:
  - List of failing test names/paths
  - Error messages and relevant output from test log
  - Stack traces (if available)

## 6. Ask to Fix Tests

→ Check failure count from step 5:

**If 30+ failures:**  
⚠️ Display: "30+ tests failed. This is too many for efficient fixing in one chat."  
→ Use AskUserQuestion:  
  - "Attempt to fix 30+ tests?" (not recommended)  
  - "No, I'll stop and create a plan"  
→ If "No" → Stop (user exits to create plan)  
→ If "Yes" → Continue to step 7  

**If 1-29 failures:**  
→ Use AskUserQuestion:  
  - "Start fixing tests?" (recommended)
  - "No, I'll fix manually"
→ If "Yes" → Continue to step 7  
→ If "No" → Stop  

## 7. Delegate to Test-Fixer Agent

→ Use the `test-fixer` agent to fix failing tests one-by-one

→ Store agent ID for potential resumption: `TEST_FIXER_AGENT_ID=[agent_id]`

→ Provide agent with context in natural language:
  - Failed test list: [bulleted list with test names and error excerpts from step 5]
  - Example failed test entry: "TestLoginFlow (test/auth.test.js) - Expected 'logged in', got undefined"

→ Provide TEST_FIXER_ENV_VARS (see Common Definitions)

→ Agent fixes the tests per its instructions and context provided

✓ Agent completes without delegation → Proceed to step 7d  
🔄 Agent exits with COMPILATION_ERROR delegation → Proceed to step 7b  

## 7b. Handle Compilation Error Delegation

→ Detect delegation signal in test-fixer's final message:  
Look for: "🔄 DELEGATION_REQUIRED: COMPILATION_ERROR"

→ Extract build errors (see EXTRACT_BUILD_ERRORS)

→ Use AskUserQuestion:
  - "Test fix introduced compilation errors. Fix them with build-fixer?"
  - "Yes" → Continue to step 7c
  - "No" → Proceed to step 7d

## 7c. Invoke Build-Fixer and Resume Test-Fixer

→ Delegate to build-fixer with error list from step 7b (see DELEGATE_TO_BUILD_FIXER)

→ After build-fixer completes: Rebuild to verify (see REBUILD_AND_VERIFY)
  - If build fails: Return to step 7b (more compilation errors)
  - If build succeeds: Continue to resume test-fixer

→ Resume test-fixer (see RESUME_TEST_FIXER)

✓ Test-fixer completes → Proceed to step 7d
🔄 Test-fixer delegates again → Loop back to step 7b (compilation errors reintroduced)  

## 7d. Ask User to Re-run Tests

→ Use AskUserQuestion:
  - "Re-run all tests to verify fixes?"
  - "No, stop for now"

✓ User confirms → Proceed to step 4 (Run Tests)  
✗ User declines → Proceed to step 8  

## 8. Completion

→ Check if all originally-failing tests were fixed:
  - If yes → Display: "✅ All tests fixed and passed!"
  - If no → Display: "⚠️ Workflow incomplete. Some tests remain unfixed."

→ Show summary:
  - Tests fixed in this session
  - Tests skipped/remaining
  - Root causes addressed

→ Clear todo list with TodoWrite (empty)  
→ Exit  

---

**⚠️  CRITICAL EXECUTION RULES**

- **Silent execution**: NEVER use `tee` when running build or test commands. Redirect all output to log files (`> "$LOG_FILE" 2>&1`). Only inspect logs when command returns non-zero exit code.
- **Exit code checking**: Always capture and check exit codes to resolve build and test success/failure. Zero = success, non-zero = failure.
- **No assumptions**: Never assume errors are "pre-existing" or skip investigating them. All errors must be analyzed unless user explicitly stops the workflow.
- **No Git Commits:** DO NOT commit changes as part of this workflow. Users will do that separately.
