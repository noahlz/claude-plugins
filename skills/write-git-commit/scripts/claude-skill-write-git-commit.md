# Claude Skill: Write Git Commit with Cost Metrics

## Skill Name
`write-git-commit`

## Purpose
Automate creation of git commits with Claude Code cost delta metrics embedded in the commit footer. Enables tracking incremental API costs per commit for transparency and accountability.

## When to Use
- After making changes tracked by the cost delta script
- When you want to record per-commit API spending
- As part of the standard commit workflow in Claude Code projects
- To maintain a historical record of computational costs

## Prerequisites
1. Git repository initialized with cost tracking
2. Cost delta script available: `./scripts/claude-cost-delta.sh`
3. Cost snapshot file exists: `.claude-cost-snapshot.json`
4. Changes staged: `git add <files>`
5. `jq` installed (for JSON parsing)

## Inputs

### Required Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `subject` | string | Commit subject line (brief description, <72 chars recommended) |
| `delta_script_path` | string | Path to cost delta script (default: `./scripts/claude-cost-delta.sh`) |
| `snapshot_file_path` | string | Path to cost snapshot (default: `.claude-cost-snapshot.json`) |

### Optional Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `body` | string | Extended commit message body (after blank line, before metrics) |
| `include_coauthor` | boolean | Include Claude Code co-author line (default: true) |
| `round_decimals` | integer | Decimal places for cost values (default: 2) |

## Process

### Step 1: Calculate Cost Delta
Execute the cost delta script to get incremental tokens and cost:
```bash
./scripts/claude-cost-delta.sh
```
Output: JSON with `date`, `delta.cost` array containing `model`, `tokens`, `cost` per model

### Step 2: Extract Session ID
Read `.claude-cost-snapshot.json` and extract `sessionId` value.

### Step 3: Parse Delta Array
Flatten the nested delta cost structure:
- Input: `{"date":"...", "delta":{"cost":[[{...}]]}}`
- Output: `[{model, tokens, cost}, ...]`
- Round cost values to specified decimal places

### Step 4: Build Cost JSON
Create single-line JSON object with structure:
```json
{"sessionId":"<value>","cost":[{model:"<string>",tokens:<number>,cost:<number>},...],"date":"<YYYY-MM-DD>"}
```
- No internal whitespace
- Strict JSON formatting
- Maintain field order: sessionId, cost array, date

### Step 5: Format Commit Message
Construct multi-line message using HEREDOC:
```
<subject-line>
<blank-line>
Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
<cost-json-single-line>
```

If optional `body` parameter provided, insert between subject and blank line:
```
<subject-line>

<body>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
<cost-json-single-line>
```

### Step 6: Execute Git Commit
Create commit with formatted message using `git commit -m "$(cat <<'EOF' ... EOF)"`

### Step 7: Verify
- Confirm commit created: `git log -1 --format=full`
- Verify cost JSON is present in commit footer
- Confirm `.claude-cost-snapshot.json` updated with new totals

## Output

### Success
```
[main <sha>] <subject-line>
 <N> files changed, <X> insertions(+), <Y> deletions(-)
```

Commit footer example:
```
Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"-Users-myproj","cost":[{"model":"claude-sonnet-4-5-20250929","tokens":5915,"cost":0.18},{"model":"claude-haiku-4-5-20251001","tokens":96318,"cost":0.13}],"date":"2025-12-12"}
```

### Failure Modes
| Error | Cause | Resolution |
|-------|-------|-----------|
| Script not found | Delta script path incorrect | Check `delta_script_path` parameter |
| Snapshot not found | Cost snapshot doesn't exist | Run delta script first |
| JSON parse error | Malformed delta output | Verify delta script works independently |
| Commit fails | Git state issue | Check `git status`, verify changes staged |
| jq not installed | JSON parsing unavailable | Install jq: `brew install jq` or `apt-get install jq` |

## Examples

### Basic Usage
```bash
write-git-commit --subject "Add new feature X"
```

### With Extended Body
```bash
write-git-commit \
  --subject "Update documentation" \
  --body "Sync master checklist with all sub-plans

- Part 1: Setup (5 items updated)
- Part 2: Electron (3 items updated)
- Part 3: Database (4 items updated)"
```

### Custom Paths
```bash
write-git-commit \
  --subject "Critical fix" \
  --delta_script_path "./tools/cost-delta.sh" \
  --snapshot_file_path "./data/.cost-snapshot.json"
```

### No Co-Author (for manual commits)
```bash
write-git-commit \
  --subject "Manual hotfix" \
  --include_coauthor false
```

## Cost JSON Field Reference

### Top-Level Fields
| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique identifier for Claude Code session; persists across commits |
| `cost` | array | Array of model cost objects |
| `date` | string | ISO 8601 date when delta was calculated (YYYY-MM-DD) |

### Cost Array Objects
| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Model identifier (e.g., `claude-sonnet-4-5-20250929`) |
| `tokens` | integer | Total tokens used for this commit (input + output + cache) |
| `cost` | number | USD cost for tokens used in this commit |

## Historical Context

### Why Per-Commit Metrics?
- **Transparency**: See API spending across project history
- **Accountability**: Track computational cost per feature/change
- **Trend Analysis**: Identify expensive commits, optimize workflow
- **Budget Planning**: Understand cumulative spend by tracking deltas

### Cost Calculation
`cost = (input_tokens + output_tokens + cache_creation_tokens) × model_rate`

Claude API rates vary by model. Consult pricing docs for current rates.

## Integration Notes

### With CI/CD
Can be integrated into pre-commit hooks to auto-calculate and embed costs:
```bash
# .git/hooks/pre-commit
./scripts/claude-skill-write-git-commit.sh \
  --subject "$(git diff --cached --name-only | head -1)" \
  || exit 1
```

### With Project Workflows
Recommended to call after:
1. Session completed
2. Feature merged
3. Significant milestone reached
4. Daily checkpoint

Not recommended:
- For every single commit (excessive metadata)
- For commits that cost < $0.01 (noise)
- Outside of Claude Code sessions (no cost data)

## Limitations

1. **Requires Running Script**: Must have executed `claude-cost-delta.sh` in same session
2. **Single Session Only**: Tracks one ccusage session at a time
3. **Manual Execution**: Not automatic; user must call skill
4. **JSON in Footer**: Some tools may not parse commit footers well
5. **No Aggregation**: Individual commit costs, not project totals

## Future Enhancements

- [ ] Auto-execute from pre-commit hook
- [ ] Generate cost reports across range of commits
- [ ] Compare costs by file type or component
- [ ] Integration with project budgeting tools
- [ ] Visualization of cost trends over time
- [ ] Export to CSV/JSON for external analysis

## See Also
- `claude-cost-delta.sh` - Calculate cost delta
- `.claude-cost-snapshot.json` - Session cost snapshot
- `ccusage` - CLI for accessing Claude API usage data

## Support
For issues with:
- **Delta calculation**: Check `./scripts/claude-cost-delta.sh` independently
- **Git operations**: Verify `git status` and staging
- **JSON formatting**: Use `jq` directly to validate output
- **ccusage**: Ensure `ccusage` CLI is installed (`npm install -g ccusage`)
