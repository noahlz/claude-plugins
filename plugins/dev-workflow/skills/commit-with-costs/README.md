# Commit Skills

Three related skills share a common commit workflow, differing only in whether they include cost metrics or stop short of committing:

| Skill | Slash Command | Description |
|-------|---------------|-------------|
| [`commit-with-costs`](#commit-with-costs) | `/commit-with-costs` | Full commit workflow with cost metrics |
| [`preview-commit-message`](#preview-commit-message) | `/preview-commit-message` | Draft message without committing |
| [`commit-only`](#commit-only) | `/commit-only` | Commit without cost metrics |

---

## commit-with-costs

Create git commits with Claude Code attribution and incremental session cost metrics embedded in commit footers.

### What It Does

Analyzes staged changes, generates a commit message, presents it for approval, then commits with Claude Code attribution and session cost metrics as [Git trailers](https://git-scm.com/docs/git-interpret-trailers).

### Prerequisites

- `node` version 22+

### Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

### Usage

```bash
/commit-with-costs
```

Or tell Claude: "commit", "write commit", "create commit", "git commit", etc.

### Cost Metrics in Commits

Each commit footer includes session cost metrics in Git trailer format:

```
Co-Authored-By: Claude Code <noreply@anthropic.com>
Claude-Cost-Metrics: {"method":"incremental","sessionId":"...","cost":[{"model":"...","inputTokens":N,"outputTokens":N,"cost":N.NN}],"since":"<ISO timestamp of last commit>"}
```

#### Incremental vs. Cumulative Tracking

| Method | Description |
|--------|-------------|
| `incremental` | Cost incurred **since the last git commit** in this session. Accurate per-commit attribution. |
| `cumulative` | Total session cost from session start. Used as a fallback when no prior commit timestamp is available (e.g., the first commit of a session). |

When `method` is `incremental`, the `since` field contains the ISO timestamp of the previous commit.

### Recommended Setup

Add to `.claude/settings.json` (create if absent) to prevent conflicts with Claude Code's built-in git workflow instructions:

```json
{
  "includeGitInstructions": false
}
```

### Configuration

On first run the skill auto-detects your session ID from the current working directory and saves it to `.claude/settings.plugins.commit-with-costs.json`:

```json
{
  "sessionId": "-Users-noahlz-projects-my-project"
}
```

**Session ID format:** Absolute paths with `/` replaced by `-`:
- `/Users/noahlz/projects/claude-plugins` → `-Users-noahlz-projects-claude-plugins`

#### Finding Your Session ID

On first use the skill lists available sessions and recommends the one closest to your working directory.

List session IDs manually:
```bash
ls ~/.claude/projects
```

### Per-Commit Cost Methodology

Session IDs are derived from the absolute path of the current working directory, so each git worktree is naturally isolated with its own cost data. In incremental mode, the cost window opens at the commit date of the most recent commit whose `Claude-Cost-Metrics` trailer contains a matching `sessionId`, deliberately skipping merge commits, manual commits, and commits from other sessions. When no prior matching commit exists, costs fall back to cumulative mode. Subagent costs are automatically included via ccusage's recursive glob, which deduplicates entries by `messageId:requestId` before aggregation.

---

## preview-commit-message

Preview a commit message from staged changes without committing.

### What It Does

Stages all changes, analyzes the diff, and displays a proposed commit message without creating a commit.

---

## commit-only

Commit staged changes with an AI-generated message. No cost metrics attached.

### What It Does

Detects an existing draft from `/preview-commit-message` (if present), or stages and generates a new message, then presents it for approval before committing.