---
name: run-and-fix-tests
description: Builds projects and runs test suites. When failures occur, delegates to analyzer agents to diagnose root causes and provide fix recommendations. Use for running tests or verifying changes.
user-invocable: true
allowed-tools:
  - Bash(npm *)
  - Bash(yarn *)
  - Bash(pnpm *)
  - Bash(node *)
  - Bash(git *)
  - Bash(make *)
  - Bash(cargo *)
  - Bash(go *)
  - Bash(python *)
  - Read
  - Grep
  - Task

---

You use this skill proactively to verify your code changes. For example, when you think "Now I should run tests to verify my changes" - activate this skill. 

Also activate this skill when the user requests testing using phrases like:
- "run tests"
- "test the changes"
- "build and test"
- "verify changes"

This skill streamlines executing and analyzing project test suites, preserving context while following a precisely-defined workflow. It:
- Resolves project build/test commands from configuration: `.claude/settings.plugins.run-and-fix-tests.json`
- Minimizes token usage by redirecting build/test output to files

When build or test failures occur:
  - Use `broken-build-analyzer` to analyze compilation errors
  - Use `failed-test-analyzer` to analyze test failures
  - Pass the agent's analysis to Plan mode

---

# Skill Context

## Reference Files 

**References:**
- [`extract-build-errors.md`](./references/extract-build-errors.md) - Build error extraction
- [`extract-test-failures.md`](./references/extract-test-failures.md) - Test failure extraction
- [`run-build.md`](./references/run-build.md) - Build execution and failure handling
- [`run-tests.md`](./references/run-tests.md) - Test execution
- [`setup-config.md`](./references/setup-config.md) - Build tool detection / configuration

**Scripts:**  [scripts/](./scripts/) - utility scripts

**Defaults:** [`assets/defaults/`](./assets/defaults/) - default build tool configurations

## Workflow Checklist

**Use this copyable checklist to accurately follow ALL steps of this skill workflow:**

```
- [ ] 1. Detect Build Configuration (If Necessary)
- [ ] 2. Load Build Configuration
- [ ] 3. Build Project (If Necessary)
- [ ] 3a. Analyze Build Errors (If Necessary)
- [ ] 4. Run tests
- [ ] 5. Analyze Test Failures
- [ ] 6. Present Test Failure Analysis to User
```

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Order of Operations

- Follow the Workflow instructions **EXACTLY** as written.
- **DO NOT SKIP** any section unless the instructions explicitly state "Go to Step [X]" or "Skip to Step [X]".
- This Workflow includes decision points - follow conditional logic precisely.

### B. Delegation Protocol

When you see `DELEGATE_TO: [file]`:
1. ALWAYS read the ENTIRE referenced file
2. Execute its instructions EXACTLY
3. After completing the file instructions, return to the main workflow and continue

### C. Narration Control ("Silence is Golden")

Only narrate steps that have a `STEP_DESCRIPTION` field. Use that exact text.

Steps without STEP_DESCRIPTION are silent - execute without output. Do not narrate section names, file reads, or internal processing.

---

⚠️ **SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. All other tool calls execute silently - no explanatory text.

---

# Skill Workflow Instructions

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests 

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_BASE_DIR` is present, display it  
✓ If `SKILL_CONFIG` is `CONFIGURED`, proceed with the workflow.  

**NOTE:** If `SKILL_CONFIG` shows `NOT_CONFIGURED` above, you will resolve and saved it to the configuration file in step 1, below.

**Template Substitution:**

Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Literal path from "Base directory for this skill:"

Example: 
- Skill header states: `Base directory for this skill: /Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests`
- `SKILL_BASE_DIR` stored as value `/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests`
- `node "{{SKILL_BASE_DIR}}/scripts/load-config.js"` becomes `node "/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests/scripts/load-config.js"`

## 1. Detect Build Configuration (If Necessary)

→ Check SKILL_CONFIG value:
  - ✓ SKILL_CONFIG: CONFIGURED → Proceed to step 2 (Load Configuration)
  - ✗ SKILL_CONFIG: NOT_CONFIGURED 
      - → Execute setup instructions from `./references/setup-config.md`
      - → Exit workflow and return to user.

## 2. Load Configuration

**STEP_DESCRIPTION**: "Loading project configuration"

→ Execute load-config script to output configuration as JSON:
```bash
node "{{SKILL_BASE_DIR}}/scripts/load-config.js"
```

**Parse the JSON output:**

→ Parse the JSON output as the project configuration  
→ Reference values using JSON attribute paths:  
  - `config.test.all.command` - test command
  - `config.build.logFile` - build log location
  - `config.build.workingDir` - build working directory
  - `config.skipBuild` - whether build should be skipped
  - `config.test.all.resultsPath` - test results file location
  - `config.test.all.errorPattern` - regex for test failures

**Output handling:**
- `nativeOutputSupport: true` → Tool has native file output (e.g., Maven's `--log-file`)
- `nativeOutputSupport: false` → Use bash redirection (`> file 2>&1`)

**Result handling:**  
✗ Script fails → Display error and stop  
✓ Script succeeds → Configuration parsed, proceed to step 3  

## 3. Build Project

→ Check `config.skipBuild` from step 2 (Configuration)

**If `config.skipBuild` is true:**  
→ Display: "Build step skipped (build command identical to test command)"  
→ Proceed directly to step 4 (Run Tests)  

**If `config.skipBuild` is false:**  
- **STEP_DESCRIPTION**: "Building project"
- → Execute Build instructions from `references/run-build.md`

## 3a. Analyze Build Errors with Sub-Agent

**STEP_DESCRIPTION**: "Analyzing build errors"

DELEGATE_TO: `references/extract-build-errors.md`

→ The extract-build-errors reference will parse errors and invoke the broken-build-analyzer agent  
→ Receive structured analysis from agent  
→ Proceed to step 3b to with analysis  

## 3b. Fix Build Errors

→ Display agent analysis to user  
→ Ask user: "Enter plan mode to implement fixes?"  
  - Yes → Use EnterPlanMode tool with analysis context  
  - No → Exit workflow  

## 4. Run Tests

**STEP_DESCRIPTION**: "Running tests"

DELEGATE_TO: `references/run-tests.md`

→ Follow test execution procedure  
→ If tests pass: Exit workflow  
→ If tests fail: Proceed to step 5  

## 5. Analyze Test Failures

**STEP_DESCRIPTION**: "Analyzing test failures"

DELEGATE_TO: `references/extract-test-failures.md`

→ The extract-test-failures reference will parse failures and invoke the failed-test-analyzer agent (if failures found)  
→ Receive structured analysis from agent  

**Result handling:**  
→ If 0 failures: Display "All tests passed" and exit workflow  
→ If 1+ failures: Proceed to step 6 with analysis results  

## 6. Present Test Failure Analysis to User

Using the analysis received from `failed-test-analyzer`:

→ Display analysis to user  
→ If the analysis has a root cause analysis and/or proposed fixes:  
  - → Ask user: "Enter plan mode to implement fixes?"
    - Yes → Use EnterPlanMode tool with analysis context
    - No → Exit workflow
→ If the analysis does not have propsed fixes → Exit workflow  

