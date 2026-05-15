---
name: zero-shot
description: Experimental. Aggressively distill LLM-facing prose to imperative essentials. Skills → 1–3 sentences. Procedural skills → numbered list. Multi-section instruction files → bullets per section.
model: opus
argument-hint: "[file-path | skill-name | agent-name | rules]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

## 1. Resolve Mode and Target 

- Set "apply" mode if invocation or user message contains indicates they want to change the file. Otherwise, set "dry-run" mode.
- Identify target (attached file, pasted markdown, file path, or skill/agent name).
- Ask via `AskUserQuestion` if mode and target are missing/ambiguous.

## 2. Classify 

Read file, record word count, then pick classification:

   | Classification | Triggers | Output |
   |---|---|---|
   | skill | Single-concept `SKILL.md` or agent without numbered steps | 1–3 imperative sentences (body only) |
   | procedural | `SKILL.md` or agent with numbered checklist or `## N.` headers | Numbered list, 1–3 sentences per step |
   | instruction | `CLAUDE.md`, `references/**`, `rules/**`, any non-sequential multi-`##` doc | Imperative bullets per `##` section |

 Precedence: 
 1. Common-knowledge override forces skill for widely-known operations (jokes, greetings, basic formatting, well-known algorithms)
 2. Procedural detection on numbered checklist (`- [ ] 1. ...`) or `##` headers beginning `1.`, `2.`, …
 3. Instruction on non-sequential file with 2+ `##` sections; (4) skill default.

## 3. Distill 

Aggression: trust LLM priors — never restate well-known formats, algorithms, or etiquette. Delete-test each sentence: if removal doesn't break the task, drop it.

Reduction targets (min): common-knowledge ≥95%, skill ≥85%, procedural ≥75%, instruction ≥60%. Miss → cut again.

Universal rules: 
- Imperative voice. One verb per bullet, no qualifiers.
- Cut framing (`Overview`, `Background`, etc.), result descriptions, H1s restating the filename, examples, rationale, and redundant "should not" clauses.
- Cut output-format prose the imperative already implies.
- Preserve frontmatter verbatim.
- Preserve non-obvious code blocks; cut illustrative ones.

Per mode: 
- **Skill** collapses body to ≤3 sentences and drops `##`. For common-knowledge operations, prefer **one sentence**.
- **Procedural** outputs numbered list (`1. **Step name.** ...`) of 1–3 sentences per step and drops `##`. Merge adjacent steps that share a single action.
- **Instruction** turns each `##` into 2–6 imperative bullets and preserves `##` headers plus rule/mapping tables. 

Output: 
- dry-run (default) prints fenced markdown headed `## Dry Run: path/to/file.md` without calling Edit
- apply uses Edit.

## 4. Report

- Print the result table, append `(dry run — file not modified)` if dry-run
- Always append `⚠ Experimental — review for lost nuance before committing.`

   | File | Mode | Before | After | Reduction |
   |---|---|---|---|---|
   | `path/to/file.md` | skill | 412 | 38 | 91% |
