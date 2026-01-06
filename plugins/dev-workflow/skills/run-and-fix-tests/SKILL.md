---
name: run-and-fix-tests
description: Build the project, run tests and systematically fix any failures. Activate when user says: "run tests", "run the tests", "test this/it/the changes", "execute tests", "build and test", "fix tests", "make sure tests pass", "verify with tests", "check if tests work/pass", "verify the fix/changes", "see if this/it works", "check that/if it works", OR when user mentions "failing/failed tests", "test failures", "CI failing", "GitHub Actions failing", "tests not passing", OR after making code changes to verify they work, OR when tests are the logical next development step.
---

This skill streamlines running and fixing unit tests in a project. It:
- resolves the project build/test commands from project-specific configuration, generating it for future use (with user input), if needed.
- strives for minimal token / context usage by redirecting build/test output to files

The skill delegates to sub-agents when there are a large number (10+) of test failures or build errors:
  - 'build-fixer' to fix compilation errors
  - 'test-fixer' to fix test failures

Activate this skill proactively after making code changes to verify they work (suggest first: "Should I run the test suite to verify these changes?").

Also activate this skill when the user requests testing using phrases like:
- "run tests"
- "test the changes"
- "build and test"
- "fix failing tests"

---

**⚠️ CRITICAL: HOW TO EXECUTE BASH CODE IN THIS SKILL**

When you see inline bash code blocks (```bash), you MUST:
- Execute them using the Bash tool
- NEVER narrate execution without actually running the command
- NEVER fabricate outputs

When instructed to "Execute from [file.md]" or "Execute instructions from [file.md]":
1. Read the markdown file using Read tool
2. Find the relevant bash code blocks
3. Execute those code blocks using Bash tool
4. Handle results as described in the file

**Failure to execute commands results in workflow corruption and invalid test runs.**

---

**⚠️  CRITICAL BUILD/TEST EXECUTION RULES**

- **Silent execution**: NEVER use `tee` when running builds or test commands. Redirect all output to log files (`> "$LOG_FILE" 2>&1`). Only inspect logs when command returns non-zero exit code.
- **Exit code checking**: Always capture and check exit codes to resolve build and test success/failure. Zero = success, non-zero = failure.
- **No assumptions**: Never assume errors are "pre-existing" or skip investigating them. All errors must be analyzed unless user explicitly stops the workflow.
- **No Git Commits:** DO NOT commit changes as part of this workflow. Users will do that separately.

---

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests

**CLAUDE_PLUGIN_ROOT**: !`if [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then $HOME/.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; elif [ -x "./.claude/resolve_plugin_root.sh" ]; then ./.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; else echo "⚠️ Run dev-workflow:setup to install resolver"; fi`

---

If you see "⚠️ Run dev-workflow:setup" above, the resolver script is missing. Stop and run the setup skill.

**⚠️ CRITICAL**: Use the `CLAUDE_PLUGIN_ROOT` value shown above in subsequent commands in this skill. Either interpolate the literal value or prefix each bash command with the value i.e. `CLAUDE_PLUGIN_ROOT=(literal value) (bash command)`

## 1. Detect Build Configuration

**Build configuration status**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Config found" || echo "⚠️ Config setup required"`

---

**Result handling:**  
✓ If you see "✓ Config found" above → Config exists, proceed to Section 2  
✗ If you see "⚠️ Config setup required" above → Config missing, proceed to Section 1a  

## 1a. Setup Build Configuration (First Run Only)

Execute ONLY if Section 1 shows "⚠️ Config setup required".

→ Execute setup instructions from `./references/setup-config.md`

**Result handling:**  
✓ Exit 0 → Config created, proceed to Section 2  
✗ Exit 1 → Display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  

## 2. Load Configuration

→ Execute load-config script to output configuration:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.js "${CLAUDE_PLUGIN_ROOT}"
```

**⚠️ CRITICAL - Capture Output Values**

The script outputs key=value pairs. Example:
```
TEST_CMD=npm test
TEST_RESULTS_PATH=dist/test-results.tap
TEST_ERROR_PATTERN=(not ok|Bail out!)
TEST_SINGLE_CMD=npm test -- {testFile}
TEST_SINGLE_RESULTS_PATH=dist/test-single-results.tap
TEST_SINGLE_ERROR_PATTERN=(not ok|Bail out!)
TEST_LOG=dist/test.log
OUT_DIR=dist
BUILD_COUNT=0
SKIP_BUILD=true
```

**Remember these values** You will use the literal values (not shell variables like `$TEST_CMD`) in subsequent bash commands.

✗ Script fails → Display error and stop  
✓ Script succeeds → Values captured, proceed to Section 3   

## 3. Build Project

→ Check the SKIP_BUILD value captured from Section 2 (literal value, not shell variable)

**If SKIP_BUILD=true:**  
→ Display: "Build step skipped (build command identical to test command)"  
→ Proceed directly to step 4 (Run Tests)  

**If SKIP_BUILD=false:**

→ Use the BUILD_COUNT value from Section 2. If BUILD_COUNT=0, no build steps exist, proceed to step 4.

→ For each build index from 0 to (BUILD_COUNT - 1), use the captured literal values:
  - BUILD_0_CMD, BUILD_0_LOG, BUILD_0_WORKING_DIR, BUILD_0_ERROR_PATTERN (if BUILD_COUNT >= 1)
  - BUILD_1_CMD, BUILD_1_LOG, BUILD_1_WORKING_DIR, BUILD_1_ERROR_PATTERN (if BUILD_COUNT >= 2)
  - etc.

→ For each build:
  - Change to working directory using the captured BUILD_i_WORKING_DIR value
  - Execute the build command using the captured BUILD_i_CMD value, redirect output to captured BUILD_i_LOG
  - Check exit code: if non-zero, record failure and continue to next build

→ If any builds fail:
  - Collect error logs from all failed builds
  - Use the BUILD_i_ERROR_PATTERN regex to parse errors from each log
  - Proceed to step 3a with aggregated error list

✓ All builds succeed → Proceed to step 4 (Run Tests)

## 3a. Extract Build Errors

→ Extract build errors (see ./references/build-procedures.md)

→ Use AskUserQuestion: "Build failed with [N] compilation errors. Fix them?"
  - "Yes" → Proceed to step 3b
  - "No" → Stop

## 3b. Delegate to Build-Fixer Agent

→ Delegate to build-fixer (see ./references/agent-delegation.md)
  - Provide error list from step 3a
  - Provide BUILD_FIXER_ENV_VARS (see ./references/agent-delegation.md)

✓ Agent completes → Proceed to step 3c

## 3c. Rebuild After Fixes

→ Rebuild and verify (see ./references/build-procedures.md)  
✓ Build succeeds → Proceed to Section 4 (Run Tests)  
✗ Build fails → Return to Section 3a (more errors)  

## 4. Run Tests

→ Use the literal values captured from Section 2 (not shell variables):

**Single test mode** (if running a specific test):
  - Use TEST_SINGLE_CMD value with {testFile} replaced
  - Redirect output to TEST_SINGLE_RESULTS_PATH value

**All tests mode** (normal case):
  - Use TEST_CMD value (captured literal, e.g., "npm test")
  - Redirect output to TEST_RESULTS_PATH value (e.g., "dist/test-results.tap")
  - Optionally capture human-readable output to TEST_LOG value (e.g., "dist/test.log")

Example bash command using literal values:  
```bash
npm test > dist/test-results.tap 2>&1
```

→ Execute test command and capture exit code  
✓ Exit 0 → All tests pass, proceed to step 8 (Completion)  
✗ Exit non-zero → Tests failed, proceed to step 5 (Extract Test Errors)  

## 5. Extract Test Errors

→ Parse test results file using the captured literal values from Section 2:
  - Read the file at TEST_RESULTS_PATH (e.g., "dist/test-results.tap")
  - Extract failures using TEST_ERROR_PATTERN regex (e.g., "(not ok|Bail out!)")

→ For detailed extraction procedure, see ./references/build-procedures.md

✓ 0 failures detected → Proceed to step 8 (Completion)  
✗ 1-30 failures → Display error summary, proceed to step 6  
✗ 30+ failures → Display count, proceed to step 6  

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

→ Delegate to the `test-fixer` agent to fix failing tests one-by-one

→ Store agent ID for potential resumption: `TEST_FIXER_AGENT_ID=[agent_id]`

→ Provide agent with context in natural language:
  - Failed test list: [bulleted list with test names and error excerpts from step 5]
  - Example failed test entry: "TestLoginFlow (test/auth.test.js) - Expected 'logged in', got undefined"

→ Provide TEST_FIXER_ENV_VARS (see ./references/agent-delegation.md)

→ Agent fixes the tests per its instructions and context provided

✓ Agent completes without delegation → Proceed to step 7d  
🔄 Agent exits with COMPILATION_ERROR delegation → Proceed to step 7b  

## 7b. Handle Compilation Error Delegation

→ Detect delegation signal in test-fixer's final message:  
Look for: "🔄 DELEGATION_REQUIRED: COMPILATION_ERROR"

→ Extract build errors (see ./references/build-procedures.md)

→ Use AskUserQuestion:
  - "Test fix introduced compilation errors. Fix them with build-fixer?"
  - "Yes" → Continue to step 7c
  - "No" → Proceed to step 7d

## 7c. Invoke Build-Fixer and Resume Test-Fixer

→ Delegate to build-fixer (see ./references/agent-delegation.md)

→ Rebuild and verify (see ./references/build-procedures.md)
  - If build fails: Return to step 7b (more compilation errors)
  - If build succeeds: Continue to resume test-fixer

→ Resume test-fixer (see ./references/agent-delegation.md)

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
