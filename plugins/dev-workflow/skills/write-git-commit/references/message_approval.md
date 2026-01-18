# Obtain Commit Message Approval 

**Contents:**
- Mandatory Message Display Instructions
- Mandatory User Approval Instructions
- Response Processing
- Return to Main Workflow

---

## Mandatory Message Display Instructions

**MANDATORY:** Use the below template EXACTLY, replacing {{COMMIT_SUBJECT}} and {{COMMIT_BODY}} with their stored values:

→ Template for message aproval:
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Mandatory User Approval Instructions

**MANDATORY:** Obtain explicit approval for the commit message from the user (never "assume" approval - ALWAYS perform this step): 

→ Use AskUserQuestion to ask "Approve this commit message?" with options:
  1. "Use full message" (Recommended)
  2. "Use just the subject"

## Response Processing

→ If user selected "Use full message": Maintain current value in COMMIT_SUBJECT variable. Maintain current value in COMMIT_BODY variable. Store "use_full" in APPROVAL_STATUS variable.  
→ If user selected "Use just the subject": Maintain current value in COMMIT_SUBJECT variable. Assign empty string `''` to COMMIT_BODY variable. Store "use_subject_only" in APPROVAL_STATUS variable.  
→ If user typed something else (ad-hoc instructions): Maintain current value in COMMIT_SUBJECT variable. Maintain current value in COMMIT_BODY variable. Store "request_revisions" in APPROVAL_STATUS variable.  

## Return to Main Workflow with Stored Values

→ Return to SKILL.md with APPROVAL_STATUS, COMMIT_SUBJECT, and COMMIT_BODY values stored mentally.
