# Ask to Fix Tests Procedure

## Prerequisites

- Failure count from Section 5
- Test failures detected and counted

---

## Decision Logic Based on Failure Count

### If 30+ Failures

⚠️ Display to user:
```
30+ tests failed. This is too many for efficient fixing in one chat.
```

→ Use AskUserQuestion with options:
- "Attempt to fix 30+ tests?" (not recommended)
- "No, I'll stop and create a plan"

**Response handling:**
- If user selects "No" → Stop workflow (user exits to create plan)
- If user selects "Yes" → Continue to SKILL.md Section 7

### If 1-29 Failures

→ Use AskUserQuestion with options:
- "Start fixing tests?" (recommended)
- "No, I'll fix manually"

**Response handling:**
- If user selects "Yes" → Continue to SKILL.md Section 7
- If user selects "No" → Stop workflow

---

## Policy Notes

- Threshold of 30 failures is the cut-off for "too many"
- Failures 1-29 are reasonable to fix in a single session
- User always has option to decline and fix manually

---

## Next Step

Return to SKILL.md and follow user's decision:
- User approved fixing → Section 7 (Delegate to Test-Fixer)
- User declined → Section 8 (Completion) with incomplete status
