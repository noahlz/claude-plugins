→ Use the BUILD_COUNT value from Section 2. If BUILD_COUNT=0, no build steps exist, proceed to step 4.

→ For each build index from 0 to (BUILD_COUNT - 1), use the captured literal values:
  - BUILD_0_CMD, BUILD_0_LOG, BUILD_0_WORKING_DIR, BUILD_0_ERROR_PATTERN, BUILD_0_NATIVE_OUTPUT (if BUILD_COUNT >= 1)
  - BUILD_1_CMD, BUILD_1_LOG, BUILD_1_WORKING_DIR, BUILD_1_ERROR_PATTERN, BUILD_1_NATIVE_OUTPUT (if BUILD_COUNT >= 2)
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

## 3a. Analyze Build Failures and Exit

**STEP_DESCRIPTION**: "Analyzing build failures"

DELEGATE_TO: `references/agent-delegation.md` - DELEGATE_TO_BUILD_ANALYZER

→ Extract build errors (see ./references/build-procedures.md - EXTRACT_BUILD_ERRORS)

→ Delegate to `broken-build-analyzer` agent with build failure context
→ Receive analysis with root causes and fix recommendations
→ Display analysis summary to user

→ Ask user: "Enter plan mode to implement fixes?"
  - Yes → Use EnterPlanMode tool with analysis context
  - No → Proceed to Section 7 (Completion)

→ Exit workflow  
