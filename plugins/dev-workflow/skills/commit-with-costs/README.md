# Commit Skills

Three related skills share a common commit workflow, differing only in whether they include cost metrics or stop short of committing:

| Skill | Slash Command | Description |
|-------|---------------|-------------|
| [`commit-with-costs`](#commit-with-costs) | `/commit-with-costs` | Full commit workflow with cost metrics |
| [`merge-with-costs`](#merge-with-costs) | `/merge-with-costs` | Merge sub-agent worktree branches with cost metrics |
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
| `merge` | Cost carried by a merge commit, counted the same way as `inc`. Written by [`merge-with-costs`](#merge-with-costs). |

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

Merge the branches a sub-agent development session left behind, resolve any conflicts, and record the project session's cost in the merge commit.

### The Problem It Solves

A merge commit made by hand carries no cost data at all, and the branches being merged carry none either — a sub-agent's commits inside a worktree have no `Claude-Cost-Metrics` trailer to anchor against. The cost of the work being integrated goes unrecorded.

### What It Does

Discovers unmerged branches, stages the merge, walks you through any conflict, then commits it with the project session's cost since its own last cost-trailered commit.

```bash
/merge-with-costs
```

### Where the Cost Comes From

Claude Code keys a project session to the directory the session was launched from, and **a sub-agent's transcripts are written under the session that dispatched it, whatever directory the sub-agent works in**. So a session run from the project root already accounts for everything its sub-agents did inside worktrees. That one session is the whole cost source:

| Source | Counted | Why |
|--------|---------|-----|
| Project-root session | Since its own last cost-trailered commit | Dispatch, review, and every sub-agent turn it spawned |
| A Claude session launched *inside* a worktree | Not counted | Its transcripts belong to that worktree's own project session |

The trailer carries `"method":"merge"` and the project `sessionId`, so the next `/commit-with-costs` on the branch anchors incrementally against the merge commit. Nothing is counted twice.

### What It Refuses To Do

Rather than record a figure it cannot stand behind, the skill stops and says why:

| Condition | Refusal |
|-----------|---------|
| Run from inside a linked worktree | Names the main working tree and asks you to run there |
| Config `sessionId` names a different project than the working directory | Cost would be read from the wrong session |
| A merged branch has its own worktree session still holding transcripts | Names the branch and session, and makes continuing an explicit choice |
| No earlier commit anchors this session | Shows the whole-session figure and asks before writing it |

### Merge Conflicts

A single-branch merge that conflicts is **left staged**, not rolled back. Paths that `git rerere` settled from a recorded resolution are staged and reported by name; the rest are walked one at a time — the conflict shown, a resolution proposed, your approval taken, then staged. Staging refuses any path still holding conflict markers, and the commit refuses while anything is unmerged. Aborting is available at every step.

Enable `git config rerere.enabled true` and git records each resolution, so the same conflict resolves itself next time.

Two or more branches are merged as one octopus commit. A failed octopus has already fast-forwarded to its first branch and leaves a half-merged tree with no conflict markers in it, so nothing there is safe to resolve in place: the skill rolls it back and asks you to re-run one branch at a time.

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