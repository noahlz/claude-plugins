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
- [ ] 1. Resolve target
- [ ] 2. Read and classify
- [ ] 3. Tighten
- [ ] 4. Report
```

## 1. Resolve Target

Identify the file(s) to tighten:

- If the user provides a file path or attached file, target that.
- If a filesystem is searchable and the user names one of these shortcuts, expand it:

| Shortcut | Expansion |
|----------|-----------|
| `skill <name>` | `**/skills/<name>/SKILL.md` + `**/skills/<name>/references/*.md` |
| `agent <name>` | `**/agents/<name>.md` |
| `docs` or `readme` | `**/README.md` (exclude `node_modules`) |
| `rules` | `**/.claude/rules/**/*.md` + `**/CLAUDE.md` |

- If empty or ambiguous, ask which file(s) to tighten.

Multiple matches: confirm scope before proceeding.

## 2. Read and Classify

Read each file. Record word count.

| Classification | Files |
|----------------|-------|
| LLM-facing | `SKILL.md`, agent `.md`, reference `.md`, rule `.md`, `CLAUDE.md` |
| External-facing | `README.md` |

## 3. Tighten

Surgical edits per classification. Do NOT rewrite from scratch.

**Context check:** Read the surrounding sentence before cutting a candidate phrase. Keep phrases that carry meaning — e.g., "You should never commit .env files" (the imperative IS the rule). Cut only padding.

| Edit | LLM-facing | External-facing |
|------|------------|-----------------|
| Voice | Imperative | — |
| Remove | Filler ("In order to", "Please note that", "You should", "Make sure to"), meta-commentary | Internal context, author sections, internal notes |
| Collapse | Verbose lists → tables | Bullets → tables or paragraphs |
| Headers | — | Scannable noun phrases |
| Preserve | Frontmatter, `---`, section headers, code blocks | Code examples, links, install instructions |

## 4. Report

Display a word count summary table:

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `path/to/file.md` | 342 | 218 | 36% |

Include totals row if multiple files were tightened.
