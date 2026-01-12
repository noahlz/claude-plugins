## Contents
- Display Format
- User Approval Options
- Response Handling
- Output Requirements

Display the proposed commit message per the following instructions:

# Message Display Instructions

**⚠️ CRITICAL: This must be your FIRST output after Step 3**
- Do NOT narrate reading this file
- Do NOT explain what you're about to do
- Start immediately with "Proposed commit message:"

## Action Required

Output the commit message to the user using this EXACT template:

```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[COMMIT_SUBJECT]

[COMMIT_BODY - include if present, omit this line if no body]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**IMPORTANT** You MUST display the proposed commit message in this format.

## Critical Requirements

1. **ASCII borders are MANDATORY** - Use ━ (U+2501 box drawing character), not dashes or equals
2. **NO PREAMBLE** - Do NOT narrate, summarize, or explain before displaying. Start output with "Proposed commit message:"
3. **Show actual message** - Do not summarize or describe, show the exact text
4. **Same turn** - Display message and call AskUserQuestion in the same response (no separate outputs)

## Template Variables

- `[COMMIT_SUBJECT]`: The subject line you generated (first line)
- `[COMMIT_BODY]`: The body bullets you generated (may be empty)

## Example Output

```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add dark mode toggle to settings

- Added toggle component with React hooks
- Integrated with theme context provider
- Updated existing components to respect theme
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

# User Approval Instructions

## Action Required

**IMPORTANT** Use the `AskUserQuestionTool` to obtain approval:

Immediately after displaying the message, call AskUserQuestion with question "Approve this commit message?" Options:
1. "Use full message" (Recommended)
2. "Use just the subject"
3. "Suggest revisions"
4. "Stop/Cancel commit"

## Response Handling

### ✓ If "Use full message"
- Extract `COMMIT_SUBJECT` (first line of message)
- Extract `COMMIT_BODY` (remaining lines, may be empty)
- Proceed to Step 5 (Fetch Cost Data)

### ✓ If "Use just the subject"
- Extract `COMMIT_SUBJECT` (first line of message)
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

## Important Notes

- This approval blocks all subsequent steps
- User must explicitly approve before fetching cost data or creating commit
- Do not proceed on assumed approval

## Next Step

If approved: Return to Step 5 with COMMIT_SUBJECT and COMMIT_BODY extracted.
