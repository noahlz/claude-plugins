---
name: tighten-for-llms
description: Tighten prose for LLM consumption. Strip filler, switch to imperative voice, collapse verbose lists. Apply to any markdown documentation — skill files, agents, references, rules, CLAUDE.md
model: sonnet
argument-hint: "[dry-run] [file-path | skill-name | agent-name | docs | readme | rules]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

Follow steps EXACTLY.

```
- [ ] 1. Resolve the target
- [ ] 2. Read and classify
- [ ] 3. Tighten
- [ ] 4. Report
```

## 1. Resolve the Target

**Mode:** Dry-run is active when the invocation contains `dry-run`, or the user's request includes "dry run", "test tightening", or "try tightening". Strip `dry-run` from the argument before resolving the target file.

Identify the target: an attached file, a pasted block of markdown, or a file path. For binary formats (docx, pdf), extract text first.

If the target is unclear, ask. Typical targets: a recently edited or created skill, agent, reference, rule, `README.md`, or `CLAUDE.md` file, or text pasted into the chat session.

## 2. Read and Classify

Read each file. Record word count.

| Classification | Files |
|----------------|-------|
| LLM-facing | `SKILL.md`, agent `.md`, reference `.md`, rule `.md`, `CLAUDE.md` |
| External-facing | `README.md` |

## 3. Tighten

Surgical edits per classification. Preserve substance, not structure — collapse or eliminate whole sections when they're mostly padding.

**Context check:** Read the surrounding sentence before cutting a candidate phrase. Keep phrases that carry meaning — e.g., "You should never commit .env files" (the imperative IS the rule). Cut only padding.

**Code block check:** If surrounding text makes a block redundant, cut the block and its scaffolding header ("Good example:", "But DO NOT:").

| Edit | LLM-facing | External-facing |
|------|------------|-----------------|
| Voice | Imperative — convert `"[Subject] should [verb]"` → `"[Verb]"` (e.g., `"The assistant should select"` → `"Select"`) | — |
| Remove | Filler (`"In order to"`, `"Please note that"`, `"You should"`, `"Make sure to"`), purpose framing (`"is designed to"`, `"is intended to"`, `"is used to"`), section intros that only announce what follows, result descriptions (sentences or sections that describe output shape rather than action), meta-commentary, example scaffolding headers when their example is cut, H1s restating the file name or type (e.g. `# CLAUDE.md`, `# Knock-Knock Joke Skill`) | Internal context, author sections, internal notes |
| Collapse | Verbose lists → tables; multi-bullet elaborations → single dense sentence or fragment | Bullets → tables or paragraphs |
| Headers | — | Scannable noun phrases |
| Preserve | Frontmatter, `---`, section headers, code blocks containing information absent from surrounding text | Code examples, links, install instructions |

**Dry-run mode:** Instead of using Edit, output the full tightened content as a fenced markdown block with the header `## Dry Run: path/to/file.md`. Do not call the Edit tool.

**Result description (cut):** `"The output will consist of five lines"` — describes the result of steps already present; cut.

## 4. Report

Display a word count summary table:

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `path/to/file.md` | 342 | 218 | 36% |

Include totals row if multiple files were tightened.

If dry-run mode: add `(dry run — file not modified)` below the table.
