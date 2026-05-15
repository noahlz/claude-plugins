# zero-shot (experimental)

Aggressively distill LLM-facing prose to imperative essentials.

> ⚠ Experimental — review output for lost nuance before applying.

## Usage

```
/zero-shot [apply] [file-path | skill <name> | agent <name> | rules]
```

| Mode | Trigger | Output |
|------|---------|--------|
| skill | `SKILL.md`, agent `.md` | 1–3 imperative sentences (body only) |
| instruction | `CLAUDE.md`, references, rules, multi-section docs | Imperative bullets per `##` section |
| skip | `README.md` | Use `/tighten-for-llms` instead |

Default is dry-run. Pass `apply` to edit the file in place.

## Examples

```
/zero-shot
```
Prompts for a target. Dry-run.

```
/zero-shot skill commit-with-costs
```
Dry-runs `commit-with-costs/SKILL.md`.

```
/zero-shot apply rules
```
Distills all `.claude/rules/**/*.md` files in place.

After processing, displays a word count table showing before/after counts and reduction percentage per file.
