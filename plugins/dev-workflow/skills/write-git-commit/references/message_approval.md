---
**Contents:**
---
- Message Display Instructions
- User Approval Instructions
- Response Processing
---

## Message Display Instructions

→ Display the following template with commit message:

```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## User Approval Instructions

→ Use AskUserQuestion to ask "Approve this commit message?" with options:
  1. "Use full message" (Recommended)
  2. "Use just the subject"
  3. "Suggest revisions"
  4. "Stop/Cancel commit"

**IMPORTANT:** Block the workflow on AskUserQuestion. Do not assume approval by the user. The user must explicitly approve before proceeding.

## Response Processing

→ If user selected "Use full message": Maintain current value in COMMIT_SUBJECT variable. Maintain current value in COMMIT_BODY variable. Store "use_full" in APPROVAL_STATUS variable.

→ If user selected "Use just the subject": Maintain current value in COMMIT_SUBJECT variable. Assign empty string `''` to COMMIT_BODY variable. Store "use_subject_only" in APPROVAL_STATUS variable.

→ If user selected "Suggest revisions": Store "request_revisions" in APPROVAL_STATUS variable. Reference file will return control for message regeneration.

→ If user selected "Stop/Cancel commit": Store "cancelled" in APPROVAL_STATUS variable. Reference file will return control for workflow termination.

Execution complete. Values available: APPROVAL_STATUS, COMMIT_SUBJECT, COMMIT_BODY
