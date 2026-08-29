# Commit Skills

Three related skills share a common commit workflow, differing only in whether they include cost metrics or stop short of committing:

| Skill | Slash Command | Description |
|-------|---------------|-------------|
| [`commit-with-costs`](#commit-with-costs) | `/commit-with-costs` | Full commit workflow with cost metrics |
| [`merge-with-costs`](#merge-with-costs) | `/merge-with-costs` | Merge sub-agent worktree branches with pooled cost metrics |
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
Claude-Cost-Metrics: {"method":"inc","cost":[{"model":"...","cost":N.NN,"in":N,"out":N,"cacheWrites":"Nk","cacheReads":"Nk"}],"since":"<ISO timestamp of last commit>","sessionId":"..."}
```

#### Incremental vs. Cumulative Tracking

| Method | Description |
|--------|-------------|
| `inc` | Cost incurred **since the last git commit** in this session. Accurate per-commit attribution. |
| `cum` | Total session cost from session start. Used as a fallback when no prior commit timestamp is available (e.g., the first commit of a session). |
| `merge` | Costs pooled across every session a merge integrates. Written by [`merge-with-costs`](#merge-with-costs). |

The `since` field is present for `inc` and `merge`, holding the ISO timestamp the cost window opens at. It is omitted for `cum`.

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

## merge-with-costs

Merge the branches a sub-agent development session left behind, and record every contributing session's cost in one merge commit.

### The Problem It Solves

Each git worktree gets its own project session, because session IDs are derived from the absolute working directory. Sub-agent commits made inside a worktree carry no `Claude-Cost-Metrics` trailer, so a plain merge commit records only what the orchestrator session spent — the sub-agents' work, usually the bulk of the cost, goes unrecorded.

### What It Does

Discovers unmerged branches and the project session that recorded each one's cost, stages an octopus merge, then commits it with the costs of every contributing session pooled by model.

```bash
/merge-with-costs
```

### Cost Attribution

| Source | Window | Why |
|--------|--------|-----|
| Each merged branch | The whole worktree session | Its commits carry no cost trailer, so there is nothing to anchor against, and a worktree session spans exactly one feature |
| Orchestrator session | Since its own last cost-trailered commit | Dispatch and review turns not already attributed to a commit on this branch |

The trailer carries `"method":"merge"` and the **orchestrator's** `sessionId`, so the next `/commit-with-costs` on the branch anchors incrementally against the merge commit. Nothing is counted twice.

### Recovering a Removed Worktree's Session

A live worktree supplies its path directly. Once the worktree is removed, the session is recovered by name: worktree session IDs are the repository's own session ID followed by the encoded worktree subpath, which ends in the branch name.

```
/repo/.claude/worktrees/003-derived  →  -repo--claude-worktrees-003-derived
```

Matching on that suffix works for any worktree root convention.

### Harvest Before Removing a Worktree

**Claude Code deletes a worktree's transcripts when the worktree is removed.** The project directory under `~/.claude/projects/` is left behind, but empty. Run this skill *before* `git worktree remove`, or the branch's cost is unrecoverable.

Branches whose transcripts are already gone are reported explicitly rather than silently counted as zero — the skill names them in Step 2 and again in the final summary.

### Merge Strategy

Two or more branches produce a single octopus merge (`git merge --no-ff --no-commit`), yielding one merge commit with all parents. Octopus refuses to run at all when any branch conflicts, so on failure the skill aborts the merge, names the conflicting paths, and stops — resolve those branches by hand.

### Configuration

Shares `commit-with-costs` configuration. Run `/commit-with-costs` once first to create `.claude/settings.plugins.commit-with-costs.json`.

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