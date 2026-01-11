# Agent Delegation Procedures

Common procedures for delegating analysis to sub-agents (broken-build-analyzer, failed-test-analyzer).

## DELEGATE_TO_BUILD_ANALYZER

Procedure to delegate to broken-build-analyzer agent:

→ Extract build errors from build log(s) (see build-procedures.md EXTRACT_BUILD_ERRORS)

→ Delegate to the `broken-build-analyzer` agent using Task tool:
  - `subagent_type: "Explore"`
  - `prompt: "Analyze compilation failures and provide root cause analysis with fix recommendations"`

→ Provide agent with context in natural language:
  - Build command used: [actual command]
  - Build log location: [path to log file]
  - Build error list: [bulleted list with file:line:col and error messages]
  - Example error entry: "src/auth.ts:45:12 - TS2304: Cannot find name 'User'"
  - Number of errors: [count]

→ Agent analyzes errors and returns:
  - Root cause analysis
  - Recommended fixes with file locations
  - Next steps if solution unclear

→ Display agent's analysis to user

→ Ask user: "Enter plan mode to implement these fixes?"
  - Yes → Use EnterPlanMode tool, include analysis in context
  - No → Proceed to completion

## DELEGATE_TO_TEST_ANALYZER

Procedure to delegate to failed-test-analyzer agent (invoked from SKILL.md Section 6):

→ Extract test failures from test results (see build-procedures.md EXTRACT_TEST_ERRORS)

→ Delegate to the `failed-test-analyzer` agent using Task tool:
  - `subagent_type: "Explore"`
  - `prompt: "Analyze test failures and provide root cause analysis with fix recommendations"`

→ Provide agent with context in natural language:
  - Test command used: [actual command]
  - Test results location: [path to results file]
  - Test log location (if available): [path to log file]
  - Failed test list: [bulleted list with test names and error excerpts]
  - Example entry: "TestLoginFlow (test/auth.test.js) - Expected 'logged in', got undefined"
  - Number of failures: [count]

→ Agent analyzes failures and returns:
  - Root cause analysis
  - Recommended fixes with file locations
  - Whether tests need updating vs code needs fixing
  - Next steps if solution unclear

→ Display agent's analysis to user

→ Ask user: "Enter plan mode to implement these fixes?"
  - Yes → Use EnterPlanMode tool, include analysis in context
  - No → Proceed to completion
