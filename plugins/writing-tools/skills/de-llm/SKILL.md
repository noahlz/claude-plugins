---
name: de-llm
description: Post-process prose to strip AI-telltale patterns — puffery, inline meta-commentary, unsourced evaluative claims. Invoke as /de-llm <path> to clean up an existing file.
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
| 3 | "Not just X, but Y" contrastive framing | Rewrite plainly |
| 4 | Promotional adjectives | Delete adjective; keep noun. If sentence collapses, delete sentence. |
| 5 | Self-referential narration | Delete meta sentence |
| 6 | Vague authority | Delete unsourced. If cited, rewrite with concrete attribution. |
| 7 | Over-hedging on verifiable facts | Strip hedge; keep direct fact |
| 8 | Premature evaluative framing | Delete framing clause; lead with fact |

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
