---
name: de-llm
description: Post-process prose to strip AI-telltale patterns — puffery, bloat, meta-commentary, false authority, and editorial framing.
user-invocable: true
argument-hint: "[file-path]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
---

**Core Rule:** Preserve facts. Strip framing, bloat, and editorial noise.

## Checklist

- [ ] 1. Read the input
- [ ] 2. Pre-scan
- [ ] 3. Load pattern details (if step 2 found matches)
- [ ] 4. Scan and edit
- [ ] 5. Write output
- [ ] 6. Report changes

---

## Step 1: Read the Input

Read the input: file path, attached file, or pasted text. Extract text from binary formats (docx, pdf) first.

## Step 2: Pre-scan

Without loading `references/patterns.md`, judge whether any of these patterns are likely present:

| # | Pattern | Action |
|---|---------|--------|
| 1 | Puffery verbs | Rewrite plainly |
| 2 | Participle bloat | Rewrite or delete |
| 3 | "Not just X, but Y" | Assert Y; drop contrast |
| 4 | Evaluative descriptors | Delete adjective or restructure clause |
| 5 | Self-referential narration | Delete |
| 6 | Vague authority | Delete (unsourced); reattribute (sourced) |
| 7 | Over-hedging on verifiable facts | Strip hedge |
| 8 | Conclusion signposts | Delete signpost; keep conclusion if supported |
| 9 | False-intimacy markers | Delete |
| 10 | Mini-conclusion headers + bullets | Delete header; fold bullets to prose |
| 11 | Bold-as-emphasis | Strip bold; rewrite if claim needs weight |
| 12 | Compressed abstraction | Expand; skip and log if referent unrecoverable |
| 13 | Numeric lead-in to bullets, tables, or section headers | Replace count or drop to noun phrase |

- None present → report "No patterns detected." and stop.
- Any present (or uncertain) → continue to step 3.

## Step 3: Load Pattern Details

Read `references/patterns.md` for detection phrases and before/after examples.

## Step 4: Scan and Edit

Scan for all 13 patterns. Skip 10 and 11 when input has no inline markdown. Preserve facts; strip framing only.

## Step 5: Write Output

Write edits back if input is an editable file; otherwise output the full revised text.

## Step 6: Report Changes

Report: `(line, pattern #, action, before → after)`.
