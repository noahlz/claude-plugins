# Message Display Instructions

## Action Required

Output the commit message to the user using this EXACT template:

```
Proposed commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[COMMIT_SUBJECT]

[COMMIT_BODY - include if present, omit this line if no body]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Critical Requirements

1. **ASCII borders are MANDATORY** - Use ━ (U+2501 box drawing character), not dashes or equals
2. **Plain text output** - Output directly to user, do NOT use Read/Write/Edit tools
3. **Display is SEPARATE from approval** - Do NOT ask "Do you approve?" in same message
4. **Show actual message** - Do not summarize or describe, show the exact text

## Template Variables

- `[COMMIT_SUBJECT]`: The subject line you generated (first line)
- `[COMMIT_BODY]`: The body bullets you generated (may be empty)

## Anti-patterns (DO NOT DO)

❌ Showing message without ASCII borders
❌ Using `-` or `=` characters instead of ━
❌ Using Read/Write/Edit tools to display
❌ Combining display with "Do you approve?" question
❌ Summarizing message instead of showing exact text
❌ Describing the message ("The message says...") instead of displaying it

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

## Verification

VERIFY (required before proceeding to User Approval Instructions)
- [ ] Output includes ASCII box borders (━━━ characters)
- [ ] Message displayed as plain text (direct output)

If verification fails, re-read reference file and retry display.

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
- Proceed to Step 4 (Fetch Cost Data)

### ✗ If "Make changes"
- Return to Step 2 (Generate Commit Message)
- Regenerate message based on user feedback
- Display new message per to Message Display Instructions
- Obtain user approval per User Approval Instructions
- Loop until approved or cancelled

### ✗ If "Stop/Cancel commit"
- Exit workflow immediately
- Do NOT proceed to Step 4
- Return control to user

## Important Notes

- This approval blocks all subsequent steps
- User must explicitly approve before fetching cost data or creating commit
- Do not proceed on assumed approval

## Next Step

If approved: Return to SKILL.md Step 4 with COMMIT_SUBJECT and COMMIT_BODY extracted.
