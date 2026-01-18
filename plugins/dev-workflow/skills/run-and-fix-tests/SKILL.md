---
name: run-and-fix-tests
description: Builds and run project tests, delegating to sub-agents for fix recommendations upon failure.
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

Activate this skill when:
- you think phrases like "Now I should run tests to verify my changes"
- the user requests test execution, using phrases like:
  - "test"
  - "run tests"
  - "test the changes"
  - "build and test"

The skill guides you through running the project build and test suite, and analyzing any failures using sub-agents to devise a break-fix plan.

---

# Skill Context

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Delegation Protocol

When you see `DELEGATE_TO: [file]`:  
⛔ **STOP** → Use Read tool on the reference file path  
→ Execute its instructions exactly (bash commands, parsing, etc.)  
→ Return to SKILL.md only after completing reference file instructions  

⚠️  **IMPORTANT:** Reference files contain Bash tool commands - use them exactly as written - never improvise commands.

### B. Template Substitution

**MANDATORY**: Replace placeholders before executing bash commands:
- `{{SKILL_BASE_DIR}}` → Installed plugin path (from skill startup message)

### C. Narration Control

⚠️  **SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently - no explanatory text.  

## SKILL_BASE_DIR value

**MANDATORY:** This skill depends on resolving the skill base directory - follow these steps EXACTLY:

DELEGATE_TO: `../../references/skill_base_dir.md`  
⛔ READ FILE FIRST - contains instructions for resolving SKILL_BASE_DIR value  

→ Store SKILL_BASE_DIR for use in all subsequent bash commands.  

---

# Skill Workflow Instructions

## Workflow Checklist

**Use this copyable checklist to EXACTLY follow ALL steps of this skill workflow:**

```
- [ ] 0. Prerequisites
- [ ] 1. Generate Build Configuration (If Necessary)
- [ ] 2. Load Build Configuration
- [ ] 3. Build Project (If Necessary)
- [ ] 3a. Analyze Build Errors (If Necessary)
- [ ] 4. Run tests
- [ ] 5. Analyze Test Failures
- [ ] 6. Present Test Failure Analysis to User
```

## 0. Prerequisites

**SKILL_NAME**: run-and-fix-tests

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.run-and-fix-tests.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

**Configuration Routing:**
- If `SKILL_CONFIG` = `NOT_CONFIGURED` → Proceed to Step 1 (Detect Build Configuration)
- If `SKILL_CONFIG` = `✓ Configuration found` → Skip Step 1, proceed directly to Step 2 (Load Configuration)

---

## 1. Generate Build Configuration

**Only execute this step if SKILL_CONFIG = NOT_CONFIGURED (checked in Prerequisites)**

→ DELEGATE_TO: `references/setup-config.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  
→ Exit workflow and return to user after config creation  

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
→ DELEGATE_TO: `references/run-build.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

## 3a. Analyze Build Errors with Sub-Agent

**STEP_DESCRIPTION**: "Analyzing build errors"

→ DELEGATE_TO: `references/extract-build-errors.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Receive structured analysis from sub-agent  
→ Proceed to step 3b with analysis  

## 3b. Fix Build Errors

→ Display sub-agent analysis to user  
→ Ask user: "Enter plan mode to implement fixes?"  
  - Yes → Use EnterPlanMode tool with analysis context  
  - No → Exit workflow  

## 4. Run Tests

**STEP_DESCRIPTION**: "Running tests"

→ DELEGATE_TO: `references/run-tests.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ If tests pass: Exit workflow  
→ If tests fail: Proceed to step 5  

## 5. Analyze Test Failures

**STEP_DESCRIPTION**: "Analyzing test failures"

→ DELEGATE_TO: `references/extract-test-failures.md`  
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE  

→ Receive structured analysis from sub-agent  

**Result handling:**  
→ If 0 failures: Display "All tests passed" and exit workflow  
→ If 1+ failures: Proceed to step 6 with analysis results  

## 6. Present Test Failure Analysis to User

Using the test-failure analysis received from the sub-agent:

→ Display analysis to user  
→ If the analysis has a root cause analysis and/or proposed fixes:  
  - → Ask user: "Enter plan mode to implement fixes?"
    - Yes → Use EnterPlanMode tool with analysis context
    - No → Exit workflow
→ If the analysis does not have proposed fixes → Exit workflow  

