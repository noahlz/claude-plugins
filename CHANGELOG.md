# Changelog

# 0.5.0

- Replaced `write-git-commit` skill with `commit-with-costs`
- Added `get-cost-trailer` skill for displaying session cost metrics without committing
- Cost metrics now track incremental cost since the last git commit (falls back to cumulative for first commit of a session)
- Refactored cost fetching, git operations, and cost computation into shared lib modules under `plugins/dev-workflow/lib/`
- Migrated all tests to new structure under `test/dev-workflow/lib/` and `test/dev-workflow/commit-with-costs/`
- Added `draft-commit-message` skill for drafting commit messages without committing
- Extracted shared reference files (`stage_and_analyze.md`, `message_guidelines.md`, `message_approval.md`) to `plugins/dev-workflow/references/` for reuse across skills
- Updated `commit-with-costs` to delegate to shared references instead of skill-local copies

# 0.4.0

- Removed legacy command wrappers (`/commit` and `/test`) now that Claude Code properly recognizes plugin skills as slash commands
- Updated all documentation to use full skill names (`/write-git-commit` and `/run-and-fix-tests`)
- Clarified that `write-git-commit` skill overrides the system commit functionality

# 0.3.0

- Yet more revisions to skills and commands to ensure consistent activation and successful execution.
- Consolidated / deleted skill instructions and reference files that were redundant / added too much cognitive load.
- Removed support for polyglot (multi-language/framework) projects - for now.
- BUG: Costs from subagents were not being captured in git commit Claude-Cost-Metrics trailer (ccusage tracks separately as "subagent" sessions)
- Improved test code coverage to >90% lines

# 0.2.0

Updated for Claude Code 2.1.0 (https://github.com/anthropics/claude-code/commit/870624)

- Added wildcard permissions to skills
- Added note to README that plugin-installed skills are not yet obeying "user-invocable: true" frontmatter (slash commandable)
- Kept install script as plugin-installed skills/commands do not seem to be hot-reloadable (yet).
- Fixed install.sh script bug

# 0.1.0

- Initial release.
