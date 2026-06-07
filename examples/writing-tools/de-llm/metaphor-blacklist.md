# Metaphor blacklist test input

Manual test for the de-llm Pattern 12 blacklist. Run:

    /de-llm examples/writing-tools/de-llm/metaphor-blacklist.md

Expected: every metaphorical use in the first paragraph is rewritten or deleted; every literal use in the second paragraph is left untouched.

## Metaphor-dense (should be revised or deleted)

The shape of our roadmap has shifted, and the tension between velocity and stability now gates every release. Only by respecting that boundary can the team unlock its true potential. Observability is woven into the very tapestry of the platform, surfacing insights and building a moat around the product, while a thin guardrail of tests gates each deploy. Each sprint is shaped by an unspoken pressure, and the interplay of these forces unlocks momentum no one can quite name; tearing down the boundary between the teams had gated our progress for a quarter, but the new shape of collaboration finally weaves it all together.

## Literal decoys (must be preserved)

The tensor's shape is (3, 4). Release the mutex to unlock the queue. The CI gate blocks merges until tests pass, and the gated rollout reaches 10% of users first. The loop's boundary condition is `i < n`. The endpoint widens the API's attack surface. The model's safety guardrails block disallowed prompts.
