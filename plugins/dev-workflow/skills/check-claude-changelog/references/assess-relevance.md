# Assess Relevance Reference

## Input

- Filtered changelog entries (from parse step)
- Project context (from Explore agent in Step 4)

## Instructions

Cross-reference changelog entries with the explored project context to identify what's most actionable for this specific project.

Rank items as HIGH (direct match to project features) or MEDIUM (likely relevant). Skip items with no clear connection to this project.

Return the top items (up to 7) sorted by relevance, each with a brief reason why it matters for this project.

Return to SKILL.md.
