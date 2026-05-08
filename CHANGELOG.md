# Changelog

# 0.12.5
- Enhanced `de-llm` skill: pattern 13 now catches numeric lead-ins to tables and section headers

# 0.12.4
- `tighten-for-llms`: added code block pruning rule; refined collapse/preserve criteria and structural rewrite constraint
- Added Stop hook reminding reinstall after plugin edits
- Improved `de-llm` skill: strip filler from action descriptions

# 0.12.3
- Overhauled `de-llm` skill: restructured as pre-scan checklist, merged patterns 4 & 8, added pattern 13 (numeric lead-in to bullets)
- Fixed: `tighten-for-llms` and `craft-linkedin-post` skills no longer emit process-speak
- Added `dist/` edit guard hook (blocks edits to built files); fixed `.gitignore` to track shared `settings.json` and ignore personal settings files
- Added `examples/` directory with manual test fixtures for `de-llm` and `tighten-for-llms`

# 0.12.2
- Enhance `de-llm` skill to expand "compressed" language (metaphors often added by LLMs)

# 0.12.1
- `tighten-for-llms` and `craft-linkedin-post` web skills now work on claude.ai with attached files or pasted text

# 0.12.0
- Added claude.ai web support: `de-llm`, `craft-linkedin-post`, and `tighten-for-llms` available as installable ZIPs
- Minor refinements to `de-llm`, `craft-linkedin-post`, and `tighten-for-llms`

# 0.11.1
- Enhanced `de-llm` skill with additional LLM indicators to detect/rewrite.

# 0.11.0
- Added `de-llm` skill to `writing-tools` plugin: post-processes prose to strip AI-telltale patterns (puffery, inline meta-commentary, unsourced evaluative claims). Invoke as `/de-llm <path>`.

# 0.10.4
- Fixed: `DELEGATE_TO` rule now prevents command guessing in commit skills
- Improvement: `update-changelog` skill now uses `AskUserQuestion` prompts for interactive confirmation

# 0.10.3
- Improvement: dev-workflow git commit skills revised to have more concise, direct instructions.

# 0.10.2
- Fixed: removed `context: fork` from all six dev-workflow skills (`commit-with-costs`, `commit-only`, `update-changelog`, `preview-commit-message`, `view-cost-metrics`, `check-claude-changelog`) — Claude Code 2.1.101 began honoring this frontmatter field, causing `AskUserQuestion` to become a deferred tool in forked contexts and breaking interactive commit workflows

# 0.10.1
- Added `AskUserQuestion` to commit skill allowed-tools to support interactive prompts during commit workflow

# 0.10.0
- Replaced `revise-for-linkedin` with `craft-linkedin-post` skill – covers full post lifecycle: outline, draft, review, and passage-by-passage revision

# 0.9.0
- Added `writing-tools` plugin with `/revise-for-linkedin` skill and `linkedin-reviewer` agent
- Renamed `tighten` → `tighten-for-llms` skill (`/dev-workflow:tighten-for-llms`)
- Fixed release-it bumper race condition for same-file multi-path writes
- Fixed `/reload-plugins` documentation to explain version-keyed cache behavior

# 0.8.0
- Added `tighten` skill for making skill, agent, reference, rule, and doc files more concise and LLM-friendly (`/tighten`)
- Added `commit-only` skill for plain git commits without cost metrics (`/commit-only`)
- Added `release-it` for automated version bumping (local tag only — no push, GitHub release, or npm publish)
- Added `update-changelog` skill for composing changelog entries from commits since last release
- Narrowed `commit-with-costs` triggers to cost-specific prompts only
- Renamed `draft-commit-message` → `preview-commit-message` skill

# 0.7.1
- Fixed duplicate commit message display in `commit-with-costs` and `draft-commit-message` skills

# 0.7.0
- Added check-claude-changelog skill. See README
- Fixed bug in commit-with-costs skill where Claude Code required permissions frequently due to the SESSION_ID typically starting with a hyphen (it looks like a flag injected into the node command line)

# 0.6.1

**Bug Fix**
- Fixed: skills fail in new projects due to guardrail preventing ad-hoc ("ambiguous") Bash ! literals in skill files.

# 0.6.0

**Skills & Features**
- Renamed `run-and-fix-tests` skill to `run-tests` (slash command: `/run-tests`)
- Replaced config-file system with LLM-driven inference for test command detection
- Added `run-command.js` script to capture all test/build output to file
- Cost tracking uses more compact JSON format (abbreviated fields) – with old formats documented for backwards compatibility.

**Architecture & Code Quality**
- Refactored `parse-test-failures.js` and `parse-build-errors.js` to CLI-arg interface with built-in format registries
- Removed:
  - Scripts for detecting build configuration (no longer needed)
  - Default config assets (`assets/defaults/`) and config detection/loading scripts
  - Shared lib scripts and reference files (no longer needed)
- Cost Tracking: added more documentation on methodology.

**Testing**
- Added `run-command.test.js` integration tests for the new command runner script
- Updated `parse-build-errors.test.js` and `parse-test-failures.test.js` for new CLI-arg interface
- Cost tracking: added more test cases for sub-agents, worktrees, and other cases. Verified incremental cost tracking works.
- Removed obsolete test files, fixtures and directories.

# 0.5.0

**Skills & Features**
- Replaced `write-git-commit` skill with `commit-with-costs` for more control over when to commit
- Added `draft-commit-message` skill for drafting commit messages without committing
- Added `get-cost-trailer` skill for viewing session cost metrics without committing
- Cost metrics now track incremental cost since the last git commit (cumulative for first commit of a session)

**Architecture & Code Quality**
- Refactored cost fetching, git operations, and cost computation into shared lib modules under `plugins/dev-workflow/lib/`
- Extracted shared reference files to `plugins/dev-workflow/references/` for reuse across skills
- Added `react-code-reviewer` and `test-quality-reviewer` agents for code review workflows
- Added knip configuration for dead code detection
- Improved test structure and code coverage
- Code cleanup and dead code removal

**Testing & Validation**
- Migrated all tests to new structure under `test/dev-workflow/`
- Fixed false-negative detection in test output format matching
- Improved skill self-checks for dependencies and git instructions

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
