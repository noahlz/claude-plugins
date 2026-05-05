---
name: craft-linkedin-post
description: Draft, review, and iterate a LinkedIn post from an outline.
user-invocable: true
---

## Workflow

1. Ask what the user wants to write about — angle, audience, examples. Do NOT draft yet.
2. Draft the post. Output in full.
3. Dispatch the `linkedin-reviewer` agent to review the draft. Output the feedback. Ask direction. Do NOT revise yet.
4. Revise passage-by-passage — original and revised side by side, pause after each; do not continue until approved:

| Response | Action |
|----------|--------|
| "original" | Keep as-is |
| "revised" | Use your version |
| "mix" / tweaks | Combine elements |
| Direct wording | Use verbatim |

5. Assemble the final post and output it in full.
6. Optionally re-run `linkedin-reviewer` for final review. Output findings; let the user decide.

## Voice

- **Story first, conclusion second.** Open with a specific experience, draw the takeaway from it.
- **Conversational.** Rhetorical questions, parenthetical asides, sentence fragments. Not presenting — talking.
- **Self-deprecating.** Admit mistakes and false starts ("I went down that road.").
- **Opinionated.** State positions directly. No "in my experience" hedging.
- **Humor via asides.** Wry parentheticals (e.g., "stop it with the em-dashes, Claude!"). Never forced.
- **Low-key closer.** Question or casual sign-off — never a call to action.
- **No buzzwords.** No "leverage," "game-changer," "unlock," "dive deep." No listicle structure.
- **Concrete.** Name the tool, quote the error, show the config line.

## LinkedIn Constraints

| Rule | Detail |
|------|--------|
| No markdown | LinkedIn doesn't render bold, italics, or headers |
| No linked text | Raw URLs only |
| Short paragraphs | Readers skim on mobile |
| Plain bullets | Use •, -, or line breaks — not markdown lists |

## Editorial Rules

- **Preserve voice.** Don't normalize to generic "LinkedIn voice."
- **No overhauls.** Rewriting >30% of a passage means you've gone too far.
- **Verbatim wording.** When the user dictates exact words, use them.
- **One passage at a time.** Never batch approvals.
- **Keep self-deprecating humor** unless the user removes it.
- **Don't soften opinions.** Flag harsh lines — never silently tone them down.
