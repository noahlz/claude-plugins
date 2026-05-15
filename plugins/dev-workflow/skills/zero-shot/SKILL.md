---
name: zero-shot
description: Experimental. Aggressively distill LLM-facing prose to imperative essentials. Skill files → 1–3 sentences. Multi-section instruction files → terse imperative bullets per section. Targets SKILL.md, agent, reference, rule, CLAUDE.md.
model: sonnet
argument-hint: "[apply] [file-path | skill-name | agent-name | rules]"
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
- [ ] 2. Classify
- [ ] 3. Distill
- [ ] 4. Report
```

## 1. Resolve the Target

**Mode:** Apply mode is active when the invocation contains `apply`, or the user's request includes "apply", "edit in place", "write it". Otherwise dry-run. Strip `apply` from the argument before resolving the target.

Identify the target: an attached file, a pasted block of markdown, a file path, or a skill/agent name. If unclear, ask. Typical targets: a recently edited skill, agent, reference, rule, or `CLAUDE.md`.

Refuse `README.md`. Suggest `/tighten-for-llms` instead.

## 2. Classify

Read the file. Record word count.

| Classification | Files | Output shape |
|----------------|-------|--------------|
| skill | `SKILL.md`, `plugins/*/agents/*.md` | 1–3 imperative sentences (body only) |
| instruction | `CLAUDE.md`, `references/**/*.md`, `rules/**/*.md`, any multi-`##` LLM-facing doc | Imperative bullets per `##` section |
| skip | `README.md` | Refuse |

Tiebreak: file has 2+ `##` sections → instruction mode, even if it has frontmatter.

## 3. Distill

Rules (both modes):

- **Imperative voice ONLY.** `"Convert X"` not `"You should convert X"` or `"Converts X"`.
- One verb per bullet/sentence. Strip qualifiers (`"typically"`, `"usually"`, `"in most cases"`).
- Cut framing sections: `Overview`, `Purpose`, `Background`, `Description`, `Behavior`, `Introduction`.
- Cut result descriptions (`"The output will be..."`).
- Cut H1s restating the filename.
- Preserve frontmatter verbatim — `name`, `description`, `model`, `argument-hint`, `allowed-tools`.
- Preserve code blocks that carry information not derivable from prose; cut illustrative-only blocks.

**Skill mode:**

- Collapse the entire body to ≤3 imperative sentences naming concrete actions.
- Drop all `##` headers in the body.
- Use fewer sentences if sufficient.

**Instruction mode:**

- Each `##` section → 2–6 imperative bullets, each starting with a verb.
- Preserve `##` headers and frontmatter.
- Keep tables that encode rules or mappings; convert prose tables to bullets.

**Dry-run mode (default):** Output the distilled content as a fenced markdown block headed `## Dry Run: path/to/file.md`. Do not call Edit.

**Apply mode:** Use Edit to write the distilled content.

## 4. Report

| File | Mode | Before | After | Reduction |
|------|------|--------|-------|-----------|
| `path/to/file.md` | skill | 412 | 38 | 91% |

Append `(dry run — file not modified)` if dry-run.

Append `⚠ Experimental — review for lost nuance before committing.`
