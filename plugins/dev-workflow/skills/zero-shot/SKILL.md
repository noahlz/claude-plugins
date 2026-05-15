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

- Default to dry-run. Use apply mode only if the user asks to change the file.
- Identify target: attached file, pasted markdown, file path, or skill/agent name.
- If target is missing or ambiguous, ask via `AskUserQuestion`.

## 2. Classify 

Read file, record word count, then pick classification:

   | Classification | Triggers | Output |
   |---|---|---|
   | skill | Single-concept `SKILL.md` or agent without numbered steps | 1–3 imperative sentences (body only) |
   | procedural | `SKILL.md` or agent with numbered checklist or `## N.` headers | Numbered list, 1–3 sentences per step |
   | instruction | `CLAUDE.md`, `references/**`, `rules/**`, any non-sequential multi-`##` doc | Imperative bullets per `##` section |

Precedence:
1. Common-knowledge override → skill (jokes, greetings, basic formatting, well-known algorithms).
2. Numbered checklist or `## N.` headers → procedural.
3. 2+ `##` sections, non-sequential → instruction.
4. Default → skill.

## 3. Distill 

Aggression: trust LLM priors — never restate well-known formats, algorithms, etiquette, or structure the imperative already implies. Delete-test every sentence: if removal doesn't break the task, drop it. Draft, then cut again — first drafts always under-cut.

Reduction targets (min): common-knowledge ≥95%, skill ≥85%, procedural ≥75%, instruction ≥60%. If draft misses, identify under-performing clauses and cut before reporting.

Write in imperative voice. One verb per bullet, no qualifiers.

Cut:
- Framing (`Overview`, `Background`, `Introduction`), result descriptions, H1s restating the filename.
- Examples, rationale, illustrative code, redundant "should not" clauses.
- Format restatement after naming the format.
- Audience qualifiers redundant with `clean`/`safe`.
- Error-fallback clauses for common-knowledge tasks — the LLM handles failure.
- Negation pairs where one implies the other.
- Layout instructions implied by a count.
- "Output only X" wrappers when the imperative already scopes the response.

Preserve: frontmatter verbatim, non-obvious code blocks.

Per mode:
- **Skill**: ≤3 sentences, drop `##`. Common-knowledge: one sentence.
- **Procedural**: numbered list (`1. **Step name.** ...`), 1–3 sentences per step, drop `##`. Merge adjacent steps sharing one action.
- **Instruction**: 2–6 imperative bullets per `##`, preserve headers and rule/mapping tables.

Output: dry-run prints fenced markdown headed `## Dry Run: <path>`. Apply uses Edit.

## 4. Report

- Recount before printing. If reduction misses target, return to Distill — never report a miss.
- Print the table; append `(dry run — file not modified)` if dry-run.
- Append `⚠ Experimental — review for lost nuance before committing.`

   | File | Mode | Before | After | Reduction |
   |---|---|---|---|---|
