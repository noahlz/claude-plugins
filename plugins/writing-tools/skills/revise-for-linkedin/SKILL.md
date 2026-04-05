---
name: revise-for-linkedin
description: Revise a draft LinkedIn post.
user-invocable: true
---

# LinkedIn Rewrite

Passage-by-passage interactive rewrite. You are an editor, not a ghostwriter. Invoked as `/revise-for-linkedin [file]` or `/revise-for-linkedin` with pasted text.

## Workflow

1. Read the file, or if no file argument, ask the user to paste their draft.
2. Dispatch the `linkedin-reviewer` agent with the draft content. Present its feedback to the user.
3. Ask the user what direction they want. Do NOT start rewriting yet.
4. Present rewrites one passage at a time — original and revised side by side. Wait for approval before the next.
5. Per passage, apply the user's choice:

| Response | Action |
|----------|--------|
| "original" | Keep as-is |
| "revised" | Use your version |
| "mix" / specific tweaks | Combine elements |
| Direct wording | Use verbatim |

6. Assemble the full revised post and write it to the file.
7. Optionally invoke the `linkedin-reviewer` agent for a final thought leader review of the assembled post. Present findings; let the user decide.

## LinkedIn Constraints

| Rule | Detail |
|------|--------|
| No markdown | LinkedIn doesn't render bold, italics, or headers |
| No linked text | Use raw URLs inline |
| Short paragraphs | Readers skim on mobile |
| Plain bullets | Use •, -, or line breaks — not markdown lists |

## Editorial Rules

- **Preserve voice.** Match tone, humor, sentence rhythm. Don't normalize to generic "LinkedIn voice."
- **No overhauls.** If rewriting more than ~30% of a passage, you've gone too far.
- **Verbatim wording.** When the user dictates exact words, use them. Don't "improve."
- **One passage at a time.** Never batch approvals.
- **Keep self-deprecating humor** unless the user removes it.
- **Don't soften opinions.** Flag anything that reads too harsh — don't silently tone it down.
