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
