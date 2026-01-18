# Instructions: Build Project

Follow these instructions to run the project build:

**Contents**
- Procedure
  - Check Build Config
  - Execute Build

## Procedure

### Check Build Config

→ Check if config.build exists and has elements:
  - If so, continue to "Execute Build from Config" below.
  - If not, return to SKILL.md and go to step 4 (Run Tests).

### Execute Build

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

