# Agent Delegation Procedures

Common procedures for delegating analysis to sub-agents (broken-build-analyzer, failed-test-analyzer).

## DELEGATE_TO_BUILD_ANALYZER

Procedure to delegate to broken-build-analyzer agent:

→ Extract build errors from build log(s) (see build-procedures.md EXTRACT_BUILD_ERRORS)

→ Delegate to the `broken-build-analyzer` agent using Task tool:
  - `subagent_type: "broken-build-analyzer"`
  - Pass config object as JSON in prompt
  - Agent reads build errors from config.build[i].logFile
  - Agent accesses config.build[i].command, config.build[i].workingDir, config.build[i].errorPattern, etc.

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
  - `subagent_type: "failed-test-analyzer"`
  - Pass config object as JSON in prompt
  - Agent reads test failures from config.test.all.resultsPath
  - Agent accesses config.test.all.command, config.test.all.errorPattern, config.skipBuild, etc.

→ Agent analyzes failures and returns:
  - Root cause analysis
  - Recommended fixes with file locations
  - Whether tests need updating vs code needs fixing
  - Next steps if solution unclear

→ Display agent's analysis to user

→ Ask user: "Enter plan mode to implement these fixes?"
  - Yes → Use EnterPlanMode tool, include analysis in context
  - No → Proceed to completion
