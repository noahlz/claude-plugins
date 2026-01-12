→ Check if config.build exists and has elements. If not, proceed to step 4 (Run Tests).

→ For each build in config.build:
  - Change to working directory using `build.workingDir`
  - Execute the build command using build.command, redirect output to `build.logFile`
  - If `build.nativeOutputSupport` is true, use tool's native output option
  - If `build.nativeOutputSupport` is false, use bash redirection (`> file 2>&1`)
  - Check exit code: if non-zero, record failure and continue to next build

→ If any builds fail:
  - Collect error logs from all failed builds using `build.logFile` paths
  - Use `build.errorPattern` regex to parse errors from each log
  - Proceed to step 3a with aggregated error list and config context

✓ All builds succeed → Proceed to step 4 (Run Tests)

## 3a. Analyze Build Failures and Exit

**STEP_DESCRIPTION**: "Analyzing build failures"

DELEGATE_TO: `references/agent-delegation.md` - DELEGATE_TO_BUILD_ANALYZER

→ Extract build errors (see ./references/build-procedures.md - EXTRACT_BUILD_ERRORS)

→ Delegate to `broken-build-analyzer` agent with build failure context and config object  
→ Receive analysis with root causes and fix recommendations  
→ Display analysis summary to user  

→ Ask user: "Enter plan mode to implement fixes?"
  - Yes → Use EnterPlanMode tool with analysis context
  - No → Proceed to step 7 (Completion)

→ Exit workflow  
