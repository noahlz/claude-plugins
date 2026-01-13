# Agent Delegation Procedures

Contents:
- HOWTO Delegate to the broken-build-analyzer
- HOWTO Delegate to the failed-test-analyzer


## HOWTO: DELEGATE_TO_BUILD_ANALYZER

→ Delegate to the `broken-build-analyzer` agent using Task tool:
  - `subagent_type: "broken-build-analyzer"`
  - Pass build config file content as literal JSON

→ Instruct the Agent to analyze build errors and return:
  - Root cause analysis
  - Recommended fixes with file locations
  - Next steps if solution unclear

→ Display agent's analysis to user

→ Ask user: "Enter plan mode to implement these fixes?"
  - Yes → Use EnterPlanMode tool, include analysis in context
  - No → Proceed to completion

## HOWTO: DELEGATE_TO_TEST_ANALYZER

→ Delegate to the `failed-test-analyzer` agent using Task tool:
  - `subagent_type: "failed-test-analyzer"`
  - Pass build config file content as literal JSON

→ Agent analyzes failures and returns:
  - Root cause analysis
  - Recommended fixes with file locations
  - Whether tests need updating vs code needs fixing
  - Next steps if solution unclear

→ Display agent's analysis to user

→ Ask user: "Enter plan mode to implement these fixes?"
  - Yes → Use EnterPlanMode tool, include analysis in context
  - No → Proceed to completion
