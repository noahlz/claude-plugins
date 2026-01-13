# Obtain Commit Message Approval 

**Contents:**
- Message Display Instructions
- User Approval Instructions
- Response Processing

---

## Message Display Instructions

**MANDATORY:** Display the below message, replacing {{COMMIT_SUBJECT}} and {{COMMIT_BODY}} with their stored values:

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

**IMPORTANT:** Block the workflow on AskUserQuestion. Do not assume approval by the user. The user must explicitly approve before proceeding.

## Response Processing

→ If user selected "Use full message": Maintain current value in COMMIT_SUBJECT variable. Maintain current value in COMMIT_BODY variable. Store "use_full" in APPROVAL_STATUS variable.  
→ If user selected "Use just the subject": Maintain current value in COMMIT_SUBJECT variable. Assign empty string `''` to COMMIT_BODY variable. Store "use_subject_only" in APPROVAL_STATUS variable.  
→ If user typed something else (ad-hoc instructions): Maintain current value in COMMIT_SUBJECT variable. Maintain current value in COMMIT_BODY variable. Store "request_revisions" in APPROVAL_STATUS variable.  

Return to SKILL.md with APPROVAL_STATUS, COMMIT_SUBJECT, and COMMIT_BODY values stored mentally.
