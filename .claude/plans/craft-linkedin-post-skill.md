# Plan: craft-linkedin-post Skill

## Goal

Replace the existing `revise-for-linkedin` skill with a new `craft-linkedin-post` skill that handles the full workflow: drafting from an outline, reviewing, and iterating passage-by-passage.

## Decision: Replace vs. Keep Both

Recommendation: replace `revise-for-linkedin`. The new skill is a superset — it drafts, reviews, and revises. Keeping both is redundant. Confirm before deleting the old skill directory.

## Steps

### 1. Create reference example files

Create `plugins/writing-tools/skills/craft-linkedin-post/examples/` with three real posts as voice references:

- `example-opencode.txt` — the "Claude ported it to TypeScript" post (paste from conversation)
- `example-anthropic.txt` — the "Anthropic, please slow down" post (paste from conversation)
- `example-claude-config.txt` — copy from `~/tmp/linkedin-post.txt`

### 2. Create SKILL.md

Create `plugins/writing-tools/skills/craft-linkedin-post/SKILL.md` with:

**Frontmatter:**
```
---
name: craft-linkedin-post
description: Draft, review, and iterate a LinkedIn post from an outline.
user-invocable: true
---
```

**Workflow:**

1. Ask the user to describe what they want to write about — their angle, audience, any specific experiences or examples they want to include. Do NOT start drafting yet.
2. Read all three example posts from the `examples/` directory to calibrate voice.
3. Draft the post. Present it to the user in full.
4. Dispatch the `linkedin-reviewer` agent. Present feedback. Ask the user what direction they want. Do NOT start revising yet.
5. Revise passage-by-passage using the same protocol as `revise-for-linkedin`:
   - Present original and revised side by side
   - Wait for approval before next passage
   - Honor: "original" / "revised" / "mix" / verbatim wording
6. Assemble the full post and write it to `~/tmp/<slug>.txt`.
7. Optionally run `linkedin-reviewer` again for a final review. Present findings; let the user decide.

**Voice notes** (calibrate the draft against these):
- Conversational, rhetorical questions and parenthetical asides
- Tells a specific personal story before drawing conclusions
- Self-deprecating ("I was skeptical", "I had hacked on that code")
- Ends with a question or low-key closer — not a call to action
- No buzzwords, no listicle structure
- Humor via parenthetical asides (e.g. "stop it with the em-dashes, Claude!")

**LinkedIn Constraints:**

| Rule | Detail |
|------|--------|
| No markdown | LinkedIn doesn't render bold, italics, or headers |
| No linked text | Use raw URLs inline |
| Short paragraphs | Readers skim on mobile |
| Plain bullets | Use •, -, or line breaks — not markdown lists |

**Editorial Rules** (for revision phase):
- Preserve voice. Match tone, humor, sentence rhythm. Don't normalize to generic "LinkedIn voice."
- No overhauls. If rewriting more than ~30% of a passage, you've gone too far.
- Verbatim wording. When the user dictates exact words, use them.
- One passage at a time. Never batch approvals.
- Keep self-deprecating humor unless the user removes it.
- Don't soften opinions. Flag anything that reads too harsh — don't silently tone it down.

### 3. Delete revise-for-linkedin

Remove `plugins/writing-tools/skills/revise-for-linkedin/` after confirming with the user.

### 4. Update README.md

In the `writing-tools` skills table, replace the `revise-for-linkedin` row with:

| `craft-linkedin-post` | Draft, review, and iterate a LinkedIn post from an outline. | `/craft-linkedin-post` |

### 5. Update marketplace.json

Bump the version in `.claude-plugin/marketplace.json`.

### 6. Run force-reinstall

```bash
./force-reinstall.sh
```

### 7. Test

Invoke `/craft-linkedin-post` in a new session and verify the full workflow: outline prompt → draft → reviewer feedback → passage-by-passage revision → file output.

## Files Touched

- `plugins/writing-tools/skills/craft-linkedin-post/SKILL.md` (new)
- `plugins/writing-tools/skills/craft-linkedin-post/examples/example-opencode.txt` (new)
- `plugins/writing-tools/skills/craft-linkedin-post/examples/example-anthropic.txt` (new)
- `plugins/writing-tools/skills/craft-linkedin-post/examples/example-claude-config.txt` (new)
- `plugins/writing-tools/skills/revise-for-linkedin/` (delete)
- `README.md` (update skills table)
- `.claude-plugin/marketplace.json` (bump version)
