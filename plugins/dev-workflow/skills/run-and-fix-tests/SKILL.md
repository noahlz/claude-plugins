---
name: run-and-fix-tests
description: Build the project, run tests and systematically fix any failures. Activate when user says: "run tests", "run the tests", "test this/it/the changes", "execute tests", "build and test", "fix tests", "make sure tests pass", "verify with tests", "check if tests work/pass", "verify the fix/changes", "see if this/it works", "check that/if it works", OR when user mentions "failing/failed tests", "test failures", "CI failing", "GitHub Actions failing", "tests not passing", OR after making code changes to verify they work, OR when tests are the logical next development step.
---

This skill streamlines running and fixing unit tests in a project. It:
- resolves the project build/test commands from project-specific configuration, generating it for future use (with user input), if needed.
- strives for minimal token / context usage by redirecting build/test output to files

The skill delegates to sub-agents when appropriate:
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

## 0. Prerequisites

**Step description**: "Checking prerequisites"

→ Set SKILL_NAME environment variable using Bash tool:
```bash
SKILL_NAME="run-and-fix-tests"
```

→ Execute prerequisite check using Bash tool:
1. Read `${CLAUDE_PLUGIN_ROOT}/common/check-prerequisites.md`
2. Find the bash code block under "Fast Path Check" section
3. Execute that bash code using Bash tool
4. Export CLAUDE_PLUGIN_ROOT variable if check passes

⚠️ CHECKPOINT: Verify you actually executed Bash tool above
- If you narrated without running Bash: STOP and run the commands now
- Check exit code to determine next step

**Result handling:**
✓ Exit 0 → All prerequisites met, CLAUDE_PLUGIN_ROOT exported, proceed to section 1
✗ Exit 1 → Prerequisites missing, proceed to section 0a

## 0a. Setup Prerequisites (First Run Only)

Execute ONLY if section 0 returned exit 1.

→ Execute setup instructions from `${CLAUDE_PLUGIN_ROOT}/common/setup-plugin.md` (via check-prerequisites.md)

**Result handling:**
✓ Exit 0 → Setup complete, CLAUDE_PLUGIN_ROOT exported, proceed to section 1
✗ Exit 1 → Display error: "Node.js 22+ required. Install from https://nodejs.org/ and restart."
✗ Exit 2 → Let natural error occur (plugin resolver issue, unexpected)

**Note:** Config generation happens in section 1 (detect build tools), so missing config is non-blocking.

## 1. Detect Build Configuration

**Step description**: "Checking build configuration"

→ Fast path check (config exists):
```bash
if [ -f "./.claude/settings.plugins.run-and-fix-tests.json" ]; then
  echo "✓ Config found"
else
  echo "⚠️ Config setup required"
  exit 1
fi
```

**Result handling:**
✓ Exit 0 → Config exists, proceed to Section 2
✗ Exit 1 → Config missing, proceed to Section 1a

## 1a. Setup Build Configuration (First Run Only)

Execute ONLY if section 1 returned exit 1.

→ Execute setup instructions from `${CLAUDE_PLUGIN_ROOT}/common/setup-config.md`

**Result handling:**
✓ Exit 0 → Config created, proceed to Section 2
✗ Exit 1 → Display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"
⚠️ Exit 2 → Display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"

## 2. Load Configuration

→ Execute load-config script to output configuration as eval-able statements:
```bash
eval "$(node ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/load-config.js "${CLAUDE_PLUGIN_ROOT}")"
```
✗ Script fails → Display error and stop  
✓ Script succeeds → Environment variables set:
  - BUILD_COUNT, BUILD_{i}_CMD, BUILD_{i}_LOG, BUILD_{i}_ERROR_PATTERN, BUILD_{i}_WORKING_DIR (for each build step)
  - TEST_CMD, TEST_RESULTS_PATH, TEST_ERROR_PATTERN
  - TEST_SINGLE_CMD, TEST_SINGLE_RESULTS_PATH, TEST_SINGLE_ERROR_PATTERN
  - TEST_LOG (optional, for human-readable logs)
  - OUT_DIR (build output directory, e.g., dist/, build/, target/)

→ Check command argument: `TEST_FILE="$1"`
→ Determine mode:
  - `$TEST_FILE` not empty → Single test mode
  - `$TEST_FILE` empty → All tests mode

→ Store initial working directory: `INITIAL_PWD=$(pwd)`

→ Determine build count: `BUILD_COUNT=$BUILD_COUNT` (number of indexed build steps)

## 3. Build Project

→ Check if build should be skipped: `$SKIP_BUILD`

**Skip Build (SKIP_BUILD=true):**
→ Display: "Build step skipped (build command identical to test command)"
→ Proceed directly to step 4 (Run Tests)

**Run Build (SKIP_BUILD=false):**
→ Create output directory: `mkdir -p "$OUT_DIR"`
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

→ Extract build errors (see ${CLAUDE_PLUGIN_ROOT}/common/build-procedures.md#extract-build-errors)

→ Use AskUserQuestion: "Build failed with [N] compilation errors. Fix them?"
  - "Yes" → Proceed to step 3b
  - "No" → Stop

## 3b. Delegate to Build-Fixer Agent

→ Delegate to build-fixer (see ${CLAUDE_PLUGIN_ROOT}/common/agent-delegation.md#delegate-to-build-fixer)
  - Provide error list from step 3a
  - Provide BUILD_FIXER_ENV_VARS (see ${CLAUDE_PLUGIN_ROOT}/common/agent-delegation.md#build-fixer-env-vars)

✓ Agent completes → Proceed to step 3c

## 3c. Rebuild After Fixes

→ Rebuild and verify (see ${CLAUDE_PLUGIN_ROOT}/common/build-procedures.md#rebuild-and-verify)
✓ Build succeeds → Proceed to Section 4 (Run Tests)
✗ Build fails → Return to Section 3a (more errors)

## 4. Run Tests

→ Determine test command based on mode:
  - Single test mode: use `$TEST_SINGLE_CMD` with {testFile} replaced, results to `$TEST_SINGLE_RESULTS_PATH`
  - All tests mode: use `$TEST_CMD`, results to `$TEST_RESULTS_PATH`

→ Change to test working directory (if different from build dir)
→ Execute test command with output redirected to results file (tool-specific)
→ If `$TEST_LOG` is set, also capture human-readable output to that file (optional)  
✓ Exit 0 → Return to INITIAL_PWD, all tests pass, proceed to step 8 (Completion)  
✗ Exit non-zero → Return to INITIAL_PWD, tests failed, proceed to step 5 (Extract Test Errors)  

## 5. Extract Test Errors

→ Extract test errors (see ${CLAUDE_PLUGIN_ROOT}/common/build-procedures.md#extract-test-errors)

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

→ Provide TEST_FIXER_ENV_VARS (see ${CLAUDE_PLUGIN_ROOT}/common/agent-delegation.md#test-fixer-env-vars)

→ Agent fixes the tests per its instructions and context provided

✓ Agent completes without delegation → Proceed to step 7d  
🔄 Agent exits with COMPILATION_ERROR delegation → Proceed to step 7b  

## 7b. Handle Compilation Error Delegation

→ Detect delegation signal in test-fixer's final message:  
Look for: "🔄 DELEGATION_REQUIRED: COMPILATION_ERROR"

→ Extract build errors (see ${CLAUDE_PLUGIN_ROOT}/common/build-procedures.md#extract-build-errors)

→ Use AskUserQuestion:
  - "Test fix introduced compilation errors. Fix them with build-fixer?"
  - "Yes" → Continue to step 7c
  - "No" → Proceed to step 7d

## 7c. Invoke Build-Fixer and Resume Test-Fixer

→ Delegate to build-fixer (see ${CLAUDE_PLUGIN_ROOT}/common/agent-delegation.md#delegate-to-build-fixer)

→ Rebuild and verify (see ${CLAUDE_PLUGIN_ROOT}/common/build-procedures.md#rebuild-and-verify)
  - If build fails: Return to step 7b (more compilation errors)
  - If build succeeds: Continue to resume test-fixer

→ Resume test-fixer (see ${CLAUDE_PLUGIN_ROOT}/common/agent-delegation.md#resume-test-fixer)

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
