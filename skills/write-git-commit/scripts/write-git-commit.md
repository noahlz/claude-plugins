# Write Git Commit with Cost Metrics

## Overview
Creates a git commit with Claude Code cost delta metrics in the commit footer. Cost metrics represent the incremental tokens and cost spent on this specific commit's changes.

## Prerequisites
- All changes staged: `git add <files>`
- Cost tracking script available: `./scripts/claude-cost-delta.sh`
- Snapshot file exists: `.claude-cost-snapshot.json`

## Steps

### 1. Calculate Cost Delta
```bash
./scripts/claude-cost-delta.sh
```
Output format:
```json
{"date":"YYYY-MM-DD","delta":{"cost":[[{model,tokens,cost},...]}}
```

### 2. Extract Session ID
Read `.claude-cost-snapshot.json` and extract the `sessionId` field.

### 3. Format Cost JSON
Flatten the nested delta cost array into a single-line JSON:
```json
{"sessionId":"<sessionId>","cost":[{model:"<model>",tokens:<int>,cost:<float>},{...}],"date":"<date>"}
```
- Round cost values to 2 decimal places
- Maintain strict JSON formatting
- One line, no whitespace breaks

### 4. Format Commit Message
Use HEREDOC to build multi-line message with proper formatting:
```bash
git commit -m "$(cat <<'EOF'
<Subject Line>

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
<cost-json-one-line>
EOF
)"
```

**Format Details:**
- Line 1: Subject line (brief description of changes)
- Line 2: Blank line
- Line 3: Co-Author attribution
- Line 4: Triple dash separator
- Line 5: Cost JSON (no line breaks)

### 5. Example
```bash
git commit -m "$(cat <<'EOF'
Update project documentation with revisions

Co-Authored-By: 🤖 Claude Code <noreply@anthropic.com>
---
{"sessionId":"-Users-noahlz-projects-ligeon","cost":[{"model":"claude-sonnet-4-5-20250929","tokens":88149,"cost":0.33},{"model":"claude-haiku-4-5-20251001","tokens":195928,"cost":0.44}],"date":"2025-12-12"}
EOF
)"
```

## Cost JSON Field Reference
- `sessionId`: From `.claude-cost-snapshot.json` - uniquely identifies the Claude Code session
- `cost`: Array of model cost objects
  - `model`: Model identifier (e.g., "claude-sonnet-4-5-20250929")
  - `tokens`: Total tokens (input + output + cache creation) for this commit
  - `cost`: Cost in USD for this commit's tokens
- `date`: ISO 8601 date when delta was calculated (from delta script output)

## Verification
After commit creation:
1. `git log -1` shows the commit with cost metrics in footer
2. `.claude-cost-snapshot.json` has been updated with current session totals
3. Next cost delta will only show incremental changes since this commit
