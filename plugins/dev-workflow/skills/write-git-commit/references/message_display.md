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

## Next Step

After displaying the message, return to SKILL.md Step 4 for user approval.

DO NOT proceed to approval in this step - display must be separate.
