# Parse Changelog Reference

## Input

- Raw changelog text from `fetch-changelog.js`
- Version list (with dates) filtered to versions since the last commit

## Instructions

Parse the raw changelog to extract entries for each version:

1. Each version section starts with `## {version}`. Collect bullet points until the next `## ` line.
2. **Filter out** entries unrelated to Claude Code CLI usage, extensibility, or development tooling. Remove items about:
   - Desktop app UI (flicker, rendering, window management)
   - VS Code / JetBrains IDE integration (unless the current project develops IDE plugins)
   - Platform-specific cosmetic fixes
3. **Deduplicate**: If a later version reverts or supersedes an earlier change, keep only the final state and drop the obsolete entry.
4. **Condense**: Summarize each entry more concisely than the original changelog text.

Return to SKILL.md with the filtered, deduplicated entries.
