---
name: de-llm
description: Post-process prose to strip AI-telltale patterns — puffery, inline meta-commentary, unsourced evaluative claims.
user-invocable: true
argument-hint: "[file-path]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
---

# de-llm

Post-process prose to remove AI-telltale patterns.

## Core Rule

**Delete unsourced evaluative claims. Rewrite sourced ones.**

A claim is "sourced" only if backed by a citation — a URL or source code reference.

## Pattern Actions

Detection phrases and before/after examples: [references/patterns.md](./references/patterns.md).

| # | Pattern | Action |
|---|---------|--------|
| 1 | Puffery verbs | Rewrite plainly |
| 2 | Participle bloat | Rewrite plainly |
| 3 | "Not just X, but Y" contrastive framing (incl. comma-splice "it's not X, it's Y" and verbed "they don't just X, they Y") | Assert Y directly; drop the contrast |
| 4 | Promotional adjectives | Delete adjective; keep noun. If sentence collapses, delete sentence. |
| 5 | Self-referential narration | Delete meta sentence |
| 6 | Vague authority | Delete unsourced. If cited, rewrite with concrete attribution. |
| 7 | Over-hedging on verifiable facts | Strip hedge; keep direct fact |
| 8 | Premature evaluative framing | Delete framing clause; lead with fact |
| 9 | Conclusion signposts ("bottom line", "TL;DR", "the takeaway") | Delete the signpost; let the conclusion stand. If unsupported, delete the conclusion too. |
| 10 | False-intimacy markers ("honestly", "frankly", "the honest truth") | Delete entirely; evidence carries sincerity, not adverbs |
| 11 | Mini-conclusion headers ("**The result:**", "**What this means:**") followed by bullets | Delete the header; fold consequence-bullets into prose. Keep bullets only for parallel enumeration. |
| 12 | Bold-as-emphasis ("**Importantly,**", "**Note that**", "**Crucially,**") | Strip the bold. If the claim needs typographic weight to land, rewrite with concrete detail. |

## Workflow

1. Read `references/patterns.md` for detection phrases and rewrite examples.
2. Read the file at `$ARGUMENTS`.
3. Scan for each pattern.
4. Apply the action above. When rewriting, preserve the fact; strip editorial framing only.
5. Write the edited file.
6. Report changes: `(line, pattern, action, before → after)`.

## Out of Scope

- Markdown, heading, list, emoji formatting — use `tighten-for-llms`.
- Prose voice or personality beyond the listed patterns.
