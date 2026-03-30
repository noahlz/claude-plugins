# Testing: commit-with-costs

Helpers in [`./helpers.js`](./helpers.js). Integration tests use `setupGitRepo(testEnv)` — must be called in `beforeEach()` to configure git user.

## Claude-Cost-Metrics Trailer Formats

The `Claude-Cost-Metrics` git trailer stores per-commit cost data as a JSON value. Two supported formats exist; older formats without a `method` field also exist in git history but should be discarded when parsing.

### Format A: Method "incremental" (long form)

```json
{
  "method": "incremental",
  "sessionId": "-Users-noahlz-projects-claude-plugins",
  "cost": [
    {"model": "claude-sonnet-4-6", "inputTokens": 87, "outputTokens": 5854, "cost": 2.19},
    {"model": "claude-opus-4-6", "inputTokens": 49, "outputTokens": 6059, "cost": 1.07},
    {"model": "claude-haiku-4-5-20251001", "inputTokens": 115, "outputTokens": 4211, "cost": 0.22}
  ],
  "since": "2026-03-05T23:40:47-05:00"
}
```

| Field | Type | Description |
|---|---|---|
| `method` | `"incremental"` | Always the literal string `"incremental"` |
| `sessionId` | string | Claude Code project/session identifier |
| `cost` | array | Per-model cost entries |
| `since` | string | ISO 8601 timestamp of previous commit (cost window start) |

Per-model fields: `model`, `inputTokens`, `outputTokens`, `cost` (all numeric token counts).

### Format B: Abbreviated fields (current)

#### Variant: `"inc"` (incremental)

```json
{
  "method": "inc",
  "cost": [
    {"model": "claude-sonnet-4-6", "cost": 3.83, "in": 138, "out": 12594, "cacheWrites": "272k", "cacheReads": "8733k"}
  ],
  "since": "2026-03-06T08:56:22-05:00",
  "sessionId": "-Users-noahlz-projects-claude-plugins--claude-worktrees-bug-incremental-costs"
}
```

#### Variant: `"cum"` (cumulative)

```json
{
  "method": "cum",
  "cost": [
    {"model": "claude-opus-4-6", "in": 73, "out": 6596, "cacheWrites": "96k", "cacheReads": "2210k", "cost": 1.87},
    {"model": "claude-sonnet-4-6", "in": 64, "out": 5461, "cacheWrites": "213k", "cacheReads": "2716k", "cost": 1.7},
    {"model": "claude-haiku-4-5-20251001", "in": 54, "out": 2143, "cacheWrites": "53k", "cacheReads": "390k", "cost": 0.12}
  ],
  "sessionId": "-Users-noahlz-projects-claude-plugins--claude-worktrees-bug-incremental-costs"
}
```

| Field | Type | Description |
|---|---|---|
| `method` | `"inc"` or `"cum"` | Incremental (since last commit) or cumulative (cleanup window) |
| `sessionId` | string | Claude Code project/session identifier |
| `cost` | array | Per-model cost entries |
| `since` | string (inc only) | ISO 8601 timestamp; absent for `"cum"` |

Per-model fields: `model`, `cost` (USD), `in`/`out` (token counts), `cacheWrites`/`cacheReads` (pre-abbreviated strings like `"272k"`, or `0` when none).
