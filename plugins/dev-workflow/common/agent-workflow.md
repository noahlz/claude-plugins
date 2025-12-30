# Error-Fixing Workflow (Common Template)

Shared workflow template for dev-workflow plugin agents.

## Mandatory Rules

1. ALWAYS Explain what you are doing step by step.
2. ALWAYS use TodoWrite for progress tracking
3. ALWAYS increment RETRY_COUNT before attempting fix in step 2b
4. ALWAYS run verification command after each fix — never batch fixes
5. ALWAYS use AskUserQuestion for retry/continue decisions
6. NEVER skip IDE diagnostics if available
7. NEVER use hacks: hard-coded values, null guards just to pass, mocked shortcuts

## Workflow

### 1. Initialize Todo List

- → Use TodoWrite to create todo list with all errors
- → One item per error
- → status="pending"
- ⚠️ CHECKPOINT: TodoWrite MUST be called before step 2

### 2. Fix Errors One-by-One

**2a. Mark in progress**

- → Update TodoWrite: status = "in_progress"
- → Initialize RETRY_COUNT = 0

**2b. Attempt fix (up to 3 retries)**

- → Increment RETRY_COUNT
- → Diagnose error (use IDE diagnostics if available)
- → Read affected files
- → Identify root cause
- → Implement fix (follow Fix Implementation Rules)
- → **Run mode-specific verification command** (see agent customizations)
- → **Check mode-specific success/failure criteria** (see agent customizations)
- → **Check if delegation required** (see agent customizations for delegation triggers)
- ✓ Success:
  - → Mark TodoWrite: status = "completed"
  - → Proceed to 2c
- ✗ Failure (non-delegation):
  - → If RETRY_COUNT < 3:
    - → Display failure reason
    - → AskUserQuestion: "Attempt to fix again?" → Yes (retry 2b) / No (skip to 2c)
  - → If RETRY_COUNT == 3:
    - → Display: "Attempted 3 times without success"
    - → AskUserQuestion: "Keep trying?" → Yes (retry 2b) / No, skip (skip to 2c) / Stop (go to step 3)
- 🔄 Delegation Required (see Delegation Protocol below):
  - → Exit with delegation signal
  - → Provide context for parent skill
  - → Parent skill invokes other agent
  - → Resume when parent skill re-invokes this agent

**2c. User choice after each error**

- → If pending errors remain: AskUserQuestion: "Fix next error?" → Yes (loop to 2a) / Stop (go to step 3)
- → If no pending errors remain: Proceed to step 3

### 3. Completion

→ Check completion status:
  - If all errors fixed → Clear TodoWrite (empty array: [])
  - If some errors fixed, some pending → Leave todos as-is

→ Display summary:
  - Errors fixed: [list]
  - Errors skipped/pending: [list if any]
  - Root causes identified: [brief list]

→ Return control to skill

## Delegation Protocol

When agent detects a blocking issue that requires another agent to resolve:

**Exit with delegation signal:**

- Display clear message: "🔄 DELEGATION_REQUIRED: [Type] - [Reason]"
- Example: "🔄 DELEGATION_REQUIRED: COMPILATION_ERROR - Test fix introduced compilation errors"
- Provide context in message:
  - Current task being worked on (e.g., "Fixing test: TestLoginFlow")
  - RETRY_COUNT value
  - What blocking errors were detected
  - Which agent should be invoked (e.g., "Need build-fixer to resolve compilation")

**Parent skill responsibilities:**

- Detect delegation signal in agent's final message
- Invoke the requested agent to resolve blocking issue
- Verify the blocking issue is resolved (e.g., rebuild to check compilation)
- Resume original agent using Task tool's resume parameter
- Provide resumption context. Example: "Compilation errors have been resolved. Continuing with test fix."

**Agent resumption:**

- Agent resumes with full conversation history (same test, RETRY_COUNT, todo list)
- Continue from step 2b (re-run verification command)
- If verification now succeeds: proceed normally
- If verification fails for different reason: continue retry loop

## Fix Implementation Rules

**ALWAYS**:

- Address root causes, not just make errors pass
- Read error context thoroughly before fixing
- Follow project coding standards and naming conventions
- Use AskUserQuestion if requirements/assertions unclear
- Use AskUserQuestion if backward-compatibility concerns arise
- Minimize code scope (prefer 1-file fixes over multi-file refactors)

**STOP AND ASK USER IF**:

- Fix requires editing 3+ files
- Fix requires 30+ lines changed
- Error seems outdated or irrelevant after refactoring
- Requirements are ambiguous

**NEVER**:

- Use hacks: hard-coded return values, null guards just to pass, shortcuts
- Assume pre-existing failures are acceptable

## Error Handling

If unrecoverable error occurs:

- Display: "[What failed] - [Why]. [Recommended action]. Stopping."
- Example: "Cannot read src/auth.ts - file not found. Check source config. Stopping."

## Communication

Before each edit: one-sentence explanation (root cause + why fix solves it)
At completion: summary (errors fixed, skipped, root causes identified)
