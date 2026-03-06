---
name: run-tests
aliases:
  - test
description: Runs the project test suite, analyzes failures, and proposes fixes via sub-agents.
allowed-tools:
  - Bash(node *)
  - Bash(git *)
  - AskUserQuestion
  - Read
  - Grep
  - Task

---

Activate this skill when:
- You say or think phrases like
  - "Running tests to verify changes"
  - "Now I should run tests to verify my changes"
- The user requests test execution, using phrases like:
  - "test"
  - "run tests"
  - "test the changes"
  - "build and test"

**IMPORTANT:** Follow the workflow steps EXACTLY as written.

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

**Node.js Check**: !`node -e "process.exit(parseInt(process.version.slice(1)) >= 22 ? 0 : 1)" 2>/dev/null && echo "✓ Node.js $(node -v)" || echo "ERROR: Node.js 22+ required (found: $(node -v 2>/dev/null || echo 'not installed')). Install: https://nodejs.org/"`

⛔ **HALT** if Node.js Check shows `ERROR`.

---

# Skill Workflow Instructions

## Workflow Rules

**MANDATORY:**

- ⛔ NEVER run test or build commands directly — use `run-command.js` for ALL execution
- ⛔ NEVER re-run tests to inspect output — Read the output file instead
- ⛔ ALL diagnostic information comes from files, never from re-execution
- Use memory to recall test commands for this project

## 1. Determine How to Build and Test

Check memory, CLAUDE.md, and project files (`package.json`, `pom.xml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.) to determine:
- The test command to run
- Whether a separate build step is required (most projects don't need one)
- The output format (TAP, pytest, go, jest, etc.)

**Quiet/silent flags:** Use `--silent`, `--quiet`, or equivalent when the build tool writes structured results to files (e.g., Maven surefire XML reports, TAP reporters, Jest JSON output). Omit quiet flags when the tool's console output is the only source of test results.

**If uncertain:** Use `AskUserQuestion`. Save the answer to memory.

## 2. Build (if needed)

Most projects don't need a separate build step. Skip this step unless you have determined one is required.

**Run build command:**
```
node "<SKILL_BASE_DIR>/scripts/run-command.js" --cmd "<build command>" --out dist/build.log
```

Parse the JSON output. If `exitCode` is non-zero:
→ DELEGATE_TO: `references/extract-build-errors.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE
→ Show analysis, ask user: "Enter plan mode to implement fixes?"
  - Yes → use EnterPlanMode with analysis context
  - No → exit workflow

## 3. Run Tests

**STEP_DESCRIPTION**: "Running tests"

Run the test command using `run-command.js` — NEVER run it directly:
```
node "<SKILL_BASE_DIR>/scripts/run-command.js" --cmd "<test command>" --out dist/test-results.log
```

Parse the JSON output. Store the `outputFile` path and `exitCode`.

**If `exitCode` = 0:** Display "All tests passed." and exit workflow.

**If `exitCode` ≠ 0:** Proceed to step 4.

## 4. Analyze Failures

**STEP_DESCRIPTION**: "Analyzing test failures"

### 4a. Read the output file

Use Read tool on the output file from step 3. Determine:
- The failure type: test failures, compilation/module errors, or crashes
- The test output format (TAP, pytest, go, jest, etc.)

⛔ Do NOT skip this step. Do NOT re-run the test command.

### 4b. Route by failure type

**If compilation/module errors or crashes** (e.g., `MODULE_NOT_FOUND`, `SyntaxError`, segfault, OOM):
→ DELEGATE_TO: `references/extract-build-errors.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

**If test failures** (assertions, expected vs actual, test names visible):
→ Run the failure parser:
```
node "<SKILL_BASE_DIR>/scripts/parse-test-failures.js" --file dist/test-results.log --format <format>
```
(Use `--pattern "<regex>"` instead of `--format` if the built-in formats don't match.)

→ **If parser returns 0 failures:** The format was wrong or output is not parseable. Fall back to the output file you already read in 4a — extract failure details manually.

→ DELEGATE_TO: `references/extract-test-failures.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

## 5. Present Analysis

Display the sub-agent analysis to the user.

If the analysis has a root cause and/or proposed fixes:
→ Ask user: "Enter plan mode to implement fixes?"
  - Yes → use EnterPlanMode with analysis context
  - No → exit workflow

If the analysis has no proposed fixes → exit workflow.
