# Commit Message Approval

Two separate actions. Do not combine them.

**Action 1 – Output the message as plain text** (not inside AskUserQuestion):

```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Action 2 – Call AskUserQuestion** (do not repeat the message in options or descriptions):

Ask "Approve this commit message?" with options:
1. "Use full message" (Recommended)
2. "Use just the subject"

Set APPROVAL_STATUS from response:
- "Use full message" → `"use_full"`
- "Use just the subject" → `"use_subject_only"`, clear COMMIT_BODY
- Anything else → `"request_revisions"`
