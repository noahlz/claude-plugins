# tighten

Make skill, agent, reference, rule, or doc files more concise and LLM-friendly.

## Usage

```
/tighten [file-path | skill <name> | agent <name> | docs | readme | rules]
```

| Mode | Target |
|------|--------|
| LLM-facing | SKILL.md, agent .md, reference .md, rule .md, CLAUDE.md |
| External-facing | README.md files |

## Examples

```
/tighten
```
Prompts for a target if none is provided.

```
/tighten skill commit-with-costs
```
Tightens `commit-with-costs/SKILL.md` and its `references/*.md` files.

```
/tighten docs
```
Tightens all `README.md` files (excluding `node_modules`).

```
/tighten rules
```
Tightens all `.claude/rules/**/*.md` and `CLAUDE.md` files.

After editing, displays a word count table showing before/after counts and reduction percentage per file.
