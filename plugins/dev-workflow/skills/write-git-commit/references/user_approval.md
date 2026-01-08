# User Approval Instructions

## Action Required

Use AskUserQuestion tool with these exact options:

## Question Options

**Question text:** "Approve this commit message?"

**Options (use these exactly):**
1. "Accept this message?" (Recommended)
2. "Make changes"
3. "Stop/Cancel commit"

## Response Handling

### ✓ If "Accept this message?"
- Extract `COMMIT_SUBJECT` (first line of message)
- Extract `COMMIT_BODY` (remaining lines, may be empty)
- Proceed to Step 5 (Fetch Cost Data)

### ✗ If "Make changes"
- Return to Step 2 (Generate Commit Message)
- Regenerate message based on user feedback
- Return to Step 3 (Display) then Step 4 (Approval)
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

If approved: Return to SKILL.md Step 5 with COMMIT_SUBJECT and COMMIT_BODY extracted.
