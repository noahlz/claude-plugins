---
name: run-and-fix-tests
description: Build the project, run tests and systematically fix any failures. Activate when user says: "run tests", "run the tests", "test this/it/the changes", "execute tests", "build and test", "fix tests", "make sure tests pass", "verify with tests", "check if tests work/pass", "verify the fix/changes", "see if this/it works", "check that/if it works", OR when user mentions "failing/failed tests", "test failures", "CI failing", "GitHub Actions failing", "tests not passing", OR after making code changes to verify they work, OR when tests are the logical next development step.
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

### B. Workflow Delegation Protocol

When step instructions say `DELEGATE_TO: [file]`:

1. **STOP** - Do not proceed based on assumed knowledge
2. **READ** - Use the Read tool to read the referenced file
3. **EXECUTE** - Follow the instructions in that file exactly
4. **VERIFY** - If a VERIFY checklist exists, confirm each item
5. **CONTINUE** - Only then proceed to the next step

**Why This Matters:**
Reference files contain formatting requirements, templates, and constraints not visible in SKILL.md. Skipping the read step causes incorrect workflow execution.

### C. Workflow Narration

Only narrate if a step has a defined "STEP_DESCRIPTION"

BEFORE narrating any step, check:
1. Does this step have a STEP_DESCRIPTION: field?
2. If YES → Narrate the STEP_DESCRIPTION value only
3. If NO → DO NOT narrate anything. Just execute WITHOUT a narration.

DO NOT:
- Narrate the section names. I.e. do NOT print messages like "Step 4. Run Tests"
- Narrate the reference you're reading. I.e do NOT print messages like "Reading test execution instructions."

Examples of silent steps (just execute the steps, DO NOT print anything):
- Read delegation files per DELEGATE_TO instructions
- Executing sub-steps within a delegation
- Internal step processing without user-facing output

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

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests 

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

---

At skill startup, extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" output message and store it for use in bash commands below.

✓ If `SKILL_CONFIG` is `CONFIGURED`, proceed with the workflow.

**NOTE:** If `SKILL_CONFIG` shows `NOT_CONFIGURED` above, it will be resolved and saved to configuration in a later step.

**HOW TO EXECUTE BASH CODE IN THIS SKILL:**

When you see inline bash code blocks (```bash), you MUST:
- **TEXT SUBSTITUTION REQUIRED:** Replace `{{SKILL_BASE_DIR}}` with the literal path from "Base directory for this skill:" message
- These are TEMPLATE PLACEHOLDERS, not shell variables - perform textual substitution before execution
- Execute the substituted command using the Bash tool
- NEVER narrate execution. ALWAYS execute the code block command
- NEVER fabricate outputs (i.e. if the tool / command fails)

**Example:**
```
#Template:
node "{{SKILL_BASE_DIR}}/scripts/detect-and-resolve.js" 

# After substitution:
node "/Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/run-and-fix-tests/scripts/detect-and-resolve.js" prepare
```

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
✗ 1-30 failures → Display error summary, proceed to step 6  
✗ 30+ failures → Display count, proceed to step 6  

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
