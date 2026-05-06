---
name: tighten-for-llms
description: Tighten prose for LLM consumption. Strip filler, switch to imperative voice, collapse verbose lists. Apply to any markdown documentation — skill files, agents, references, rules, CLAUDE.md
model: sonnet
argument-hint: "[file-path | skill-name | agent-name | docs | readme | rules]"
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
| Voice | Imperative | — |
| Remove | Filler ("In order to", "Please note that", "You should", "Make sure to"), meta-commentary, example scaffolding headers when their example is cut, H1s restating the file name or type (e.g. `# CLAUDE.md`, `# Knock-Knock Joke Skill`) | Internal context, author sections, internal notes |
| Collapse | Verbose lists → tables; multi-bullet elaborations → single dense sentence or fragment | Bullets → tables or paragraphs |
| Headers | — | Scannable noun phrases |
| Preserve | Frontmatter, `---`, section headers, code blocks containing information absent from surrounding text | Code examples, links, install instructions |

## 4. Report

Display a word count summary table:

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `path/to/file.md` | 342 | 218 | 36% |

Include totals row if multiple files were tightened.
