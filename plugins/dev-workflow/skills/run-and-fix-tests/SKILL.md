---
name: run-and-fix-tests
description: Builds projects, runs test suites, and systematically fixes failures via build-fixer and test-fixer agents. Use for running tests, fixing failures, or verifying changes.
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
1. Read the referenced file
2. Execute its instructions exactly
3. Check any VERIFY checklists
4. Return to continue the workflow

Reference files contain detailed requirements not in SKILL.md. Always read them.

### C. Narration Control

Only narrate steps that have a `STEP_DESCRIPTION` field. Use that exact text.

Steps without STEP_DESCRIPTION are silent - execute without output. Do not narrate section names, file reads, or internal processing.

## Workflow Checklist

```
- [ ] Load configuration
- [ ] Build project (or skip)
- [ ] Run tests
- [ ] Extract errors (if any)
- [ ] Get user approval
- [ ] Delegate to test-fixer
- [ ] Complete
```

## Skill Organization

**References:**
- [`setup-config.md`](./references/setup-config.md) - Build tool detection
- [`run-build.md`](./references/run-build.md) - Build execution
- [`run-tests.md`](./references/run-tests.md) - Test execution
- [`build-procedures.md`](./references/build-procedures.md) - Error extraction
- [`ask-to-fix.md`](./references/ask-to-fix.md) - User decision logic
- [`fix-tests.md`](./references/fix-tests.md) - Test-fixer delegation
- [`agent-delegation.md`](./references/agent-delegation.md) - Sub-agent env vars
- [`completion.md`](./references/completion.md) - Summary and cleanup

**Scripts:**  [scripts/](./scripts/) - untilty scripts

**Defaults:** [`assets/defaults/`](./assets/defaults/) - default build tool configurations

---

This skill streamlines running and fixing unit tests in a project. It:
- resolves the project build/test commands from project-specific configuration, generating it for future use (with user input), if needed.
- strives for minimal token / context usage by redirecting build/test output to files

The skill delegates to sub-agents when there are a large number (10+) of test failures or build errors:
  - 'build-fixer' to fix compilation errors
  - 'test-fixer' to fix test failures

## Feedback Loop

This skill iterates: run tests → extract failures → fix one test → repeat until all pass.

Activate this skill proactively after making code changes to verify they work (suggest first: "Should I run the test suite to verify these changes?").

Also activate this skill when the user requests testing using phrases like:
- "run tests"
- "test the changes"
- "build and test"
- "fix failing tests"

---

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests 

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_CONFIG` is `CONFIGURED`, proceed with the workflow.

**NOTE:** If `SKILL_CONFIG` shows `NOT_CONFIGURED` above, it will be resolved and saved to configuration in a later step.

**Template Substitution:**

Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Literal path from "Base directory for this skill:"

Example: `node "{{SKILL_BASE_DIR}}/scripts/detect.js"` becomes `node "/path/to/skills/run-and-fix-tests/scripts/detect.js"`

## 1. Detect Build Configuration

Execute ONLY if Step 0. Prerequisites has "SKILL_CONFIG: NOT_CONFIGURED".

→ Execute setup instructions from `./references/setup-config.md`

**Result handling:**  
✓ Exit 0 → Config created, proceed to Section 2  
✗ Exit 1 → Display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  

## 2. Load Configuration

**STEP_DESCRIPTION**: "Loading project configuration"

→ Execute load-config script to output configuration:
```bash
node "{{SKILL_BASE_DIR}}/scripts/load-config.js"
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

→ Store these literal values in memory for use in subsequent sections
→ Use the literal values (not shell variables like `$TEST_CMD`) in bash commands

**Output handling flags:**
- `nativeOutputSupport: true` → Tool has native file output (e.g., Maven's `--log-file`)
- `nativeOutputSupport: false` → Use bash redirection (`> file 2>&1`)

**Result handling:**  
✗ Script fails → Display error and stop  
✓ Script succeeds → Values captured, proceed to Section 3   

## 3. Build Project

→ Check the SKIP_BUILD value captured from Section 2 (literal value, not shell variable)

**If SKIP_BUILD=true:**  
→ Display: "Build step skipped (build command identical to test command)"  
→ Proceed directly to step 4 (Run Tests)  

**If SKIP_BUILD=false:**

**STEP_DESCRIPTION**: "Building project"

→ Execute Build instructions from `references/run-build.md`

## 4. Run Tests

**STEP_DESCRIPTION**: "Running tests"

DELEGATE_TO: `references/run-tests.md`

→ Follow test execution procedure  
→ Return to Section 5 if tests fail, Section 8 if tests pass  

## 5. Extract Test Errors

**STEP_DESCRIPTION**: "Analyzing test failures"

→ Parse test results file using the captured literal values from Section 2:
  - Read the file at TEST_RESULTS_PATH (e.g., "dist/test-results.tap")
  - Extract failures using TEST_ERROR_PATTERN regex (e.g., "(not ok|Bail out!)")

→ For detailed extraction procedure, see ./references/build-procedures.md

✓ 0 failures detected → Proceed to step 8 (Completion)  
✗ 1-10 failures → Display error summary, proceed to step 6  
✗ 10+ failures → Display count, proceed to step 6  

## 6. Ask to Fix Tests

DELEGATE_TO: `references/ask-to-fix.md`

→ Follow decision logic based on failure count  
→ Handle user response per reference instructions  
→ Proceed to Section 7 if user approves, stop if user declines  

## 7. Delegate to Test-Fixer Agent

→ Execute instructions for using `test-fixer` agent from `references/fix-tests.md`

## 8. Completion

DELEGATE_TO: `references/completion.md`

→ Generate status summary
→ Clear todo list
→ Exit workflow  
