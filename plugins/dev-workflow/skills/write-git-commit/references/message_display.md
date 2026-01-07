Show the proposed the commit message using the EXACTLY as follows:

- MUST display commit message with ASCII box borders (━ characters) - this is mandatory.
- MUST output as plain text (direct output, NOT a tool call).
- Do NOT batch display with approval request - display first, THEN ask for approval in next step.

**Template for displaying commit message:**
```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Subject line]

[Body if present]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```