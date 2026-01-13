---
**Contents**:
- Message Display Instructions
- User Approval Options
- Response Handling
- Output Requirements
---

# Message Display Instructions

→ Display from template:
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

# User Approval Instructions

## Action Required

**ALWAYS** Use AskUserQuestion to ask "Approve this commit message?" Options:
1. "Use full message" (Recommended)
2. "Use just the subject"
3. "Suggest revisions"
4. "Stop/Cancel commit"

**IMPORTANT:**
- You must block the workflow on the AskUserQuestion tool before proceeding.
- Do not assume approval by the user. The user must **ALWAYS** explicitly approve before you create the git commit

## Response Handling

### ✓ If "Use full message"
- Keep both`COMMIT_SUBJECT` and `COMMIT_BODY` (remaining lines, may be empty)
- Proceed to Step 5 (Fetch Cost Data)

### ✓ If "Use just the subject"
- Keep `COMMIT_SUBJECT` (first line of message)
- Set `COMMIT_BODY` empty.
- Proceed to Step 5 (Fetch Cost Data)

### ✗ If "Suggest revisions"
- Return to Step 3 (Generate Commit Message)
- Regenerate message based on user feedback
- Display new message per the Message Display Instructions
- Obtain user approval per User Approval Instructions
- Loop until approved or cancelled

### ✗ If "Stop/Cancel commit"
- Exit workflow immediately
- Do NOT proceed to Step 5
- Return control to user
