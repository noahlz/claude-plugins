# Re-measure a Past Merge

Recovery only, outside the merge flow: correct an existing merge commit's `Claude-Cost-Metrics`
trailer (e.g. wrong session after a re-keyed transcript, or double-counted).

## 1. Find the Window

Window: (SINCE, UNTIL], SINCE exclusive. Use author dates – anchors read `%aI`.

```bash
git log -1 --format=%aI {{PREVIOUS_COST_COMMIT}}   # → SINCE
git log -1 --format=%aI {{BAD_MERGE}}              # → UNTIL
```

PREVIOUS_COST_COMMIT: last commit before BAD_MERGE whose trailer covers the project session.

## 2. Measure

Run from the main working tree:

```bash
node "{{PLUGIN_ROOT}}/skills/merge-with-costs/scripts/merge-workflow.js" prepare-merge --since "{{SINCE}}" --until "{{UNTIL}}"
```

Add `--include-sessions`, `--branches`, `--no-floor` as the original merge should have.

- `--since` replaces the project anchor (otherwise BAD_MERGE's own trailer) and so the floor.
- `--until` caps every window. An included session's anchor at or after UNTIL is ignored.
- Costs use current pricing, so they can differ from a trailer written earlier. Token counts reproduce
  exactly – compare those to check a re-measure.

| `status` | Action |
|----------|--------|
| `success` | Store `data.current_cost`, `data.since`, `data.session_id`, `data.included_sessions`. |
| `invalid_range` | UNTIL is not after SINCE, or a date did not parse. Fix the dates and re-run. |
| `invalid_session` | Show the message, then drop the session or halt. |
| Otherwise | Display the error and halt. |

## 3. Amend

Show per-model costs and the replacement trailer line. Get approval via **AskUserQuestion**:

```
Claude-Cost-Metrics: {"method":"merge","cost":<current_cost>,"since":"<since>","pooled":[<included ids>],"sessionId":"<session_id>"}
```

Keep this key order. Omit `pooled` when no session was included.

- BAD_MERGE is HEAD → amend with the full message, trailer replaced. Author date is kept, so later
  anchors stay correct.
  ```bash
  git commit --amend -F - <<'EOF'
  {{CORRECTED_MESSAGE}}
  EOF
  ```
- BAD_MERGE is not HEAD → halt. Rewriting it needs a rebase, so hand the trailer to the user.

Never push. A pushed BAD_MERGE needs a force-push – tell the user and let them decide.
