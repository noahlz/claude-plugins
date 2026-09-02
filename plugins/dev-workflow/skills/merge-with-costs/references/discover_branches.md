# Discover Merge Candidates

**IMPORTANT:** NEVER run `git worktree`, `git branch`, or `git merge` directly. Use the script.

---

## Execute Command

```bash
node "{{SKILL_BASE_DIR}}/scripts/merge-workflow.js" discover
```

## Parse JSON Output

→ `status` → STATUS

→ If STATUS = "success":
  - `data.repo_root` → REPO_ROOT
  - `data.current_branch` → CURRENT_BRANCH
  - `data.candidates` → CANDIDATES (array)
  - `data.unaccounted_sessions` → UNACCOUNTED_SESSIONS (array of {branch, session_id})

| Candidate field | Meaning |
|-----------------|---------|
| `branch` | Branch name to merge |
| `commits_ahead` | Commits not reachable from HEAD |
| `worktree_live` | Worktree still registered |
| `worktree_locked` | A Claude session currently holds the worktree |
| `worktree_session_id` | Project session keyed to that worktree's own directory |
| `resolved_by` | `worktree` (path) or `branch-name` (worktree already removed) |
| `worktree_session_has_data` | `true`: a Claude session ran inside that worktree; its cost is NOT in this merge |

→ If STATUS = "no_candidates", "merge_in_progress", or "error":
  - `message` → ERROR_MESSAGE

**Warn about any candidate with `worktree_locked: true`** — a Claude session is still running there
and may not have committed its work.
