---
name: write-git-commit
description: Create a git commit with Claude Code cost metrics embedded in the commit footer. Activate when user wants to commit changes or mentions commit, git commit, or create commit.
---

## 1. Load Configuration and Calculate Costs

→ Source `${CLAUDE_PLUGIN_ROOT}/scripts/load-config.sh` to load configuration
  - Loads `$METRICS_FILE` path (default: `.claude/cost-metrics.json`)
  - Loads `$SESSION_FILTER` for session filtering (default: null for first session)

→ Calculate cost delta: Run `${CLAUDE_PLUGIN_ROOT}/scripts/claude-cost-delta.sh "$METRICS_FILE"`
  - Outputs JSON cost array: `[{"model":"...","tokens":N,"cost":N.NN}]`
  - On error: Display error message and stop

→ Extract current session ID: `ccusage session --json | jq -r '.sessions[0].sessionId'`
→ Get current timestamp in ISO 8601 format: `date -u +%Y-%m-%dT%H:%M:%SZ`

## 2. Get Commit Message

→ Ask user for commit subject (brief, imperative)
→ Optionally ask for body (longer explanation)

## 3. Build and Preview Commit Message

→ Build single-line JSON cost footer:
  `{"sessionId":"<id>","cost":<cost-array>,"date":"<ISO-8601-date>"}`

→ Format full commit message:
```
<subject>

<body (optional)>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
<cost-json-footer>
```

→ Display formatted commit message to user

→ Use AskUserQuestion:
  - "Proceed with this commit?" (recommended)
  - "No, let me edit the message"
  - "Other"

✓ "Proceed" → Continue to section 4 (Create Commit)
✗ "No, let me edit" → Return to section 2 (Get Commit Message)

## 4. Create Commit

→ Execute: `git commit -m "..."`
✓ Exit 0 → Commit created, proceed to section 5 (Append to Metrics File)
✗ Exit non-zero → Display error, return to section 2 (Get Commit Message)

## 5. Append to Metrics File

→ Get commit SHA: `COMMIT_SHA=$(git rev-parse HEAD)`
→ Run: `${CLAUDE_PLUGIN_ROOT}/scripts/append-cost-metrics.sh "$METRICS_FILE" "$COMMIT_SHA" "<subject>" "$COST_DELTA"`
✓ Script appends entry to metrics file → Proceed to section 6 (Update .gitignore)
✗ Script fails → Display error but continue to section 6 (Update .gitignore) anyway (commit was created)

## 6. Update .gitignore (Optional)

→ Check if metrics file is in `.gitignore`
✓ Already ignored → Proceed to section 7 (Success)
✗ Not ignored → Ask user: "Add metrics file to .gitignore?"
  - "Yes" → Add to .gitignore, proceed to section 7 (Success)
  - "No" → Continue to section 7 (Success)

## 7. Success

✅ Commit created with cost metrics in footer
✅ Metrics entry appended to historical file
→ Display commit SHA
→ Display metrics file location
✓ Done

🔧 Configuration: `.claude/commit-config.json` (optional)
  - `metricsFile`: Path to metrics file (default: `.claude/cost-metrics.json`)
  - `sessionFilter`: Optional session filter string (default: `null` = use first/most recent session)
    - Example: `"ligeon"` to filter sessions containing "ligeon"
📁 Metrics file: `.claude/cost-metrics.json` (NDJSON, one entry per line)
📁 Scripts used:
  - `claude-cost-delta.sh` - Calculates cost delta from ccusage
  - `append-cost-metrics.sh` - Appends entry to metrics file
