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

Post-process prose to remove AI-telltale patterns. Invoked after text exists — not a style guide applied during generation.

## Core Rule

**Delete unsourced evaluative claims. Rewrite sourced ones.**

A claim is "sourced" only if backed by a citation — a URL or source code reference. Cut unsourced rhetoric.

## Pattern Actions

Catalog with examples: [references/patterns.md](./references/patterns.md).

| # | Pattern | Action |
|---|---------|--------|
| 1 | Puffery verbs ("stands as", "serves as", "is a testament to", "underscores") | Rewrite plainly |
| 2 | Participle bloat (trailing `-ing`: "further enhancing", "contributing to") | Rewrite plainly |
| 3 | "Not just X, but Y" contrastive framing | Rewrite plainly |
| 4 | Promotional adjectives ("robust", "seamless", "powerful", "comprehensive", "elegant", "cutting-edge") | Delete adjective; keep noun. If sentence collapses, delete sentence. |
| 5 | Self-referential narration ("this section explores", "it's worth noting") | Delete meta sentence |
| 6 | Vague authority ("experts agree", "researchers argue", "widely considered") | Delete unsourced. If cited, rewrite with concrete attribution. |
| 7 | Over-hedging on verifiable facts ("generally", "typically", "in most cases") | Strip hedge; keep direct fact |
| 8 | Premature evaluative framing ("X is an important tool that...") | Delete framing clause; lead with fact |

## Workflow

1. Read the file at `$ARGUMENTS`.
2. Scan for each pattern.
3. Apply the action above. When rewriting, preserve the fact; strip editorial framing only.
4. Write the edited file.
5. Report changes: `(line, pattern, action, before → after)`.

No interactive prompts mid-run. Show the report at the end.

## Out of Scope

- Markdown, heading, list, emoji formatting — use `tighten-for-llms`.
- Prose voice or personality beyond the listed patterns.
