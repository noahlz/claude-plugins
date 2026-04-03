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

### Terminology

**Terminology note:** ccusage refers to a project directory as a "session" (keyed by its filesystem path). Claude Code calls these "projects" (stored in `~/.claude/projects/`). The skill config field `sessionId` is therefore a project path identifier, not a Claude Code session UUID.

### What It Does

Using this skill, Claude:

- Analyzes staged changes and creates a descriptive commit message
- Presents the message for user approval before committing
- Embeds Claude Code attribution and session cost metrics as [Git trailers](https://git-scm.com/docs/git-interpret-trailers)

### Prerequisites

- `node` version 22+

### Dependencies

- **ccusage** - Claude Code usage library ([ryoppippi/ccusage](https://github.com/ryoppippi/ccusage))
  - Installed automatically by the plugin via `package.json`

### Usage

Slash command:

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

Extract cost metrics from git history to JSONL:

```bash
git log --format="{\"sha\":\"%h\", \"cost\":%(trailers:key=Claude-Cost-Metrics,valueonly,separator=%x09)"
```

#### Incremental vs. Cumulative Tracking

The `method` field in `Claude-Cost-Metrics` indicates how costs were calculated:

| Method | Description |
|--------|-------------|
| `incremental` | Cost incurred **since the last git commit** in this session. Accurate per-commit attribution. |
| `cumulative` | Total session cost from session start. Used as a fallback when no prior commit timestamp is available (e.g., the first commit of a session). |

When `method` is `incremental`, the `since` field contains the ISO timestamp of the previous commit, allowing you to reconstruct cost timelines across commits.

### Recommended Setup

Add the following to your project's `.claude/settings.json` (create if it doesn't exist):

```json
{
  "includeGitInstructions": false
}
```

This disables Claude Code's built-in git commit workflow instructions (introduced in Claude Code 2.1.69), which can conflict with this skill.

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

Or with the [ccusage CLI](https://ccusage.com/guide/installation):
```bash
ccusage session --json
```

### Shared References

This skill uses shared reference files located in `plugins/dev-workflow/references/`:

| Reference | Purpose |
|-----------|---------|
| `stage_and_analyze.md` | Stage changes and analyze diff |
| `message_guidelines.md` | Commit message format and conventions |
| `message_approval.md` | User approval workflow |

Cost-specific references remain in `references/` within this skill directory:

| Reference | Purpose |
|-----------|---------|
| `fetch_cost.md` | Fetch session cost metrics via ccusage |
| `create_commit.md` | Create the git commit with trailers |

### Per-Commit Cost Methodology

#### Session Isolation by Working Directory

The session ID is derived from the absolute path of the current working directory (`pwdToSessionId` in `lib/ccusage-operations.js`). Because each git worktree has a distinct path, each gets its own `~/.claude/projects/<session-id>/` directory. Concurrent Claude sessions in different worktrees of the same repo never share cost data.

#### Incremental Cost Anchoring

In incremental mode, the cost window opens at the commit date of the most recent commit whose `Claude-Cost-Metrics` trailer contains a matching `sessionId` (`getLastCostCommitDate` in `lib/git-operations.js`). This deliberately skips merge commits, manual commits, and commits from other sessions. When no prior matching commit exists (first commit of a session), costs fall back to cumulative mode — all usage since session start.

#### Subagent Cost Inclusion

When Claude spawns subagents, their usage is written to nested files within the session directory:

```
~/.claude/projects/<session-id>/<session-uuid>/subagents/agent-*.jsonl
```

`loadSessionBlockData` (ccusage) uses a recursive `**/*.jsonl` glob scoped to the session directory, so subagent entries are automatically included. The same API call appears in both the parent and subagent files; ccusage deduplicates by `messageId:requestId` before aggregation. See `lib/cost-computation.js#computeCosts` for how entries are flattened and filtered.

---

## preview-commit-message

Preview a commit message from staged changes without committing.

### What It Does

Using this skill, Claude:

- Stages all changes with `git add -A`
- Analyzes the diff (or uses existing knowledge of edits made in conversation)
- Generates a commit message following the shared message guidelines
- Displays the proposed message **without committing**

### Usage

Slash command:

```
/preview-commit-message
```

Or tell Claude: "draft a commit message", "write a commit message", "preview a commit message", etc.

### Shared References

This skill uses shared reference files located in `plugins/dev-workflow/references/`:

| Reference | Purpose |
|-----------|---------|
| `stage_and_analyze.md` | Stage changes and analyze diff |
| `message_guidelines.md` | Commit message format and conventions |

---

## commit-only

Commit staged changes with an AI-generated message. No cost metrics attached.

### What It Does

Using this skill, Claude:

- Detects an existing draft from `/preview-commit-message` (if present), or stages and generates a new message
- Presents the proposed message for approval
- Creates the git commit on approval

### Usage

Slash command:

```bash
/commit-only
```

Or tell Claude: "commit", "commit my changes", "just commit", "commit without costs", etc.

### Workflow with preview-commit-message

You can chain skills for a review-then-commit flow:

1. `/preview-commit-message` — review the generated message
2. `/commit-only` — commit using the already-generated message (skips regeneration)

### Shared References

This skill uses shared reference files located in `plugins/dev-workflow/references/`:

| Reference | Purpose |
|-----------|---------|
| `stage_and_analyze.md` | Stage changes and analyze diff |
| `message_guidelines.md` | Commit message format and conventions |
| `message_approval.md` | Display message and obtain user approval |

---

## Skill Chaining

The three skills compose into two common flows:

- **Review then commit (no costs):** `/preview-commit-message` drafts the message; `/commit-only` picks it up and commits without regenerating.
- **Commit with costs directly:** `/commit-with-costs` handles staging, message generation, approval, and cost-annotated commit in one step.

Use `/preview-commit-message` when you want to review or edit the message before it lands. Use `/commit-only` when you want a clean commit without cost trailers. Use `/commit-with-costs` when you want full attribution and cost tracking in the git history.

---

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)