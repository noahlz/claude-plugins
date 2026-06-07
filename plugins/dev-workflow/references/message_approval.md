# Commit Message Approval

Display the message and request approval in a **single AskUserQuestion call**. Embed the message in the `question` field so it always renders — never use plain-text narration, which the skill's silence rules suppress. This overrides the Narration/silent rule regardless of STEP_DESCRIPTION marking.

Call **AskUserQuestion** with `question` set to the full message block:

```
Approve this commit message?

{{COMMIT_SUBJECT}}

{{COMMIT_BODY}}
```

(Omit the blank line and `{{COMMIT_BODY}}` when the body is empty.)

Options:
1. "Use full message" (Recommended)
2. "Use just the subject"

Set APPROVAL_STATUS from the response:
- "Use full message" → `"use_full"`
- "Use just the subject" → `"use_subject_only"`, clear COMMIT_BODY
- Anything else → `"request_revisions"`
