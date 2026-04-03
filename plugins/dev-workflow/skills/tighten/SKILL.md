---
name: tighten
description: Make skill, agent, reference, rule, or doc files more concise and LLM-friendly.
model: sonnet
argument-hint: "[file-path | skill-name | agent-name | docs | readme | rules]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

**MANDATORY:** Only activate when user invokes `/tighten` directly. Follow steps EXACTLY.

---

# Skill Workflow Checklist

**Progress:**

```
- [ ] 1. Resolve target
- [ ] 2. Read and classify
- [ ] 3. Tighten
- [ ] 4. Report
```

---

# Skill Workflow Instructions

## 1. Resolve Target

Parse `$ARGUMENTS` using this table:

| Input | Target |
|-------|--------|
| File path | That file |
| `skill <name>` | Glob `**/skills/<name>/SKILL.md` + `**/skills/<name>/references/*.md` |
| `agent <name>` | Glob `**/agents/<name>.md` |
| `docs` or `readme` | Glob `**/README.md` (exclude `node_modules`) |
| `rules` | Glob `**/.claude/rules/**/*.md` + `**/CLAUDE.md` |
| Empty or ambiguous | Ask via AskUserQuestion |

Multiple matches: confirm scope before proceeding.

## 2. Read and Classify

Read each file. Record word count.

| Classification | Files |
|----------------|-------|
| LLM-facing | `SKILL.md`, agent `.md`, reference `.md`, rule `.md`, `CLAUDE.md` |
| External-facing | `README.md` |

## 3. Tighten

Surgical edits per classification. Do NOT rewrite from scratch.

| Edit | LLM-facing | External-facing |
|------|------------|-----------------|
| Voice | Imperative | — |
| Remove | Filler ("In order to", "Please note that", "You should", "Make sure to"), meta-commentary | Internal context, author sections, internal notes |
| Collapse | Verbose lists → tables | Bullets → tables or paragraphs |
| Headers | — | Scannable noun phrases |
| Preserve | Frontmatter, `---`, section headers, code blocks, DELEGATE_TO | Code examples, links, install instructions |

## 4. Report

Display a word count summary table:

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `path/to/file.md` | 342 | 218 | 36% |

Include totals row if multiple files were tightened.
