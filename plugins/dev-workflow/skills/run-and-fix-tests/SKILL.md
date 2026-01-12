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
3. Return to the main workflow and continue

### C. Narration Control

Only narrate steps that have a `STEP_DESCRIPTION` field. Use that exact text.

Steps without STEP_DESCRIPTION are silent - execute without output. Do not narrate section names, file reads, or internal processing.

## Workflow Checklist

**Use this copyable checklist to accurately follow ALL steps of this skill workflow:**

```
- [ ] Load configuration
- [ ] Build project (or skip)
- [ ] Run tests
- [ ] Extract failures (if any)
- [ ] Delegate to analyzer
- [ ] Exit with analysis
```

## Skill Organization

**References:**
- [`agent-delegation.md`](./references/agent-delegation.md) - Analyzer delegation
- [`build-procedures.md`](./references/build-procedures.md) - Error extraction procedures
- [`completion.md`](./references/completion.md) - Summary and exit
- [`run-build.md`](./references/run-build.md) - Build execution and failure handling
- [`run-tests.md`](./references/run-tests.md) - Test execution
- [`setup-config.md`](./references/setup-config.md) - Build tool detection

**Scripts:**  [scripts/](./scripts/) - utility scripts

**Defaults:** [`assets/defaults/`](./assets/defaults/) - default build tool configurations

---

This skill streamlines running unit tests in a project. It:
- Resolves project build/test commands from configuration (auto-generated on first use)
- Minimizes token usage by redirecting build/test output to files
- Delegates to analyzer agents when failures occur to provide root cause analysis

When failures occur, the skill:
  - Delegates to `broken-build-analyzer` for compilation errors
  - Delegates to `failed-test-analyzer` for test failures
  - Exits the workflow with analysis and fix recommendations
  - Optionally enters plan mode for the user to implement fixes

Activate this skill proactively after making code changes to verify they work (suggest first: "Should I run the test suite to verify these changes?").

Also activate this skill when the user requests testing using phrases like:
- "run tests"
- "test the changes"
- "build and test"
- "verify changes"

---

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests 

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_BASE_DIR` is present, display it  
✓ If `SKILL_CONFIG` is `CONFIGURED`, proceed with the workflow.  

**NOTE:** If `SKILL_CONFIG` shows `NOT_CONFIGURED` above, it will be resolved and saved to configuration in a later step.

**Template Substitution:**

Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Literal path from "Base directory for this skill:"

Example: 
- Skill header states: `Base directory for this skill: /Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests`
- `SKILL_BASE_DIR` stored as value `/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests`
- `node "{{SKILL_BASE_DIR}}/scripts/load-config.js"` becomes `node "/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests/scripts/load-config.js"`

## 1. Detect Build Configuration

Execute ONLY if Step 0. Prerequisites has "SKILL_CONFIG: NOT_CONFIGURED".

→ Execute setup instructions from `./references/setup-config.md`

**Result handling:**  
✓ Exit 0 → Config created, proceed to step 2  
✗ Exit 1 → Display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  

## 2. Load Configuration

**STEP_DESCRIPTION**: "Loading project configuration"

→ Execute load-config script to output configuration as JSON:
```bash
node "{{SKILL_BASE_DIR}}/scripts/load-config.js"
```

**Parse the JSON output:**

The script outputs JSON configuration for project build and test commands.

→ Parse the JSON output as the project configuration  
→ Reference values using paths like:  
  - `config.test.all.command` - test command
  - `config.build[0].logFile` - build log location
  - `config.build[0].workingDir` - build working directory
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

**If config.skipBuild is true:**
→ Display: "Build step skipped (build command identical to test command)"
→ Proceed directly to step 4 (Run Tests)

**If config.skipBuild is false:**
- **STEP_DESCRIPTION**: "Building project"
- → Execute Build instructions from `references/run-build.md`

## 3a. Analyze Build Failures and Exit

**STEP_DESCRIPTION**: "Analyzing build failures"

DELEGATE_TO: `references/agent-delegation.md` - DELEGATE_TO_BUILD_ANALYZER

→ Extract build errors (see `./references/build-procedures.md` - EXTRACT_BUILD_ERRORS)
→ Delegate to `broken-build-analyzer` agent with build failure context and config object  
→ Receive analysis with root causes and fix recommendations  
→ Display analysis summary to user  
→ Ask user: "Enter plan mode to implement fixes?"  
  - Yes → Use EnterPlanMode tool with analysis context
  - No → Proceed to step 7 (Completion)
→ Exit workflow  

## 4. Run Tests

**STEP_DESCRIPTION**: "Running tests"

DELEGATE_TO: `references/run-tests.md`

→ Follow test execution procedure  
→ Return to step 5 if tests fail, step 7 (Completion) if tests pass

## 5. Extract Test Errors

**STEP_DESCRIPTION**: "Analyzing test failures"

→ Parse test results file using config from step 2:
  - Read the file at `config.test.all.resultsPath` (e.g., "dist/test-results.tap")
  - Extract failures using `config.test.all.errorPattern` regex (e.g., "(not ok|Bail out!)")

→ For detailed extraction procedure, see `./references/build-procedures.md`

✓ 0 failures detected → Proceed to step 7 (Completion)  
✗ 1+ failures → Display error summary, proceed to step 6  

## 6. Delegate to Analyzer and Exit

DELEGATE_TO: `references/agent-delegation.md`

→ Delegate to `failed-test-analyzer` agent with test failure context  
→ Receive analysis with root causes and fix recommendations  
→ Display analysis summary to user  
→ Ask user: "Enter plan mode to implement fixes?"  
  - Yes → Use EnterPlanMode tool with analysis context
  - No → Proceed to step 7
→ Exit workflow  

## 7. Completion

DELEGATE_TO: `references/completion.md`

→ Generate status summary  
→ Exit workflow  
