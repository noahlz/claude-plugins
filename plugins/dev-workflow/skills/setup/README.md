# Setup Skill

Set up the plugin resolver script required by all dev-workflow skills.

## Purpose

This skill creates `resolve_plugin_root.sh`, a helper script that all dev-workflow skills use to resolve plugin installation paths at runtime.

**Why is this needed?**
Due to [Claude Code Issue #9354](https://github.com/anthropics/claude-code/issues/9354), the `${CLAUDE_PLUGIN_ROOT}` environment variable doesn't expand properly in skill markdown files. This skill creates a workaround script that all other skills depend on.

## Installation

Run this skill once after installing the dev-workflow plugin. All subsequent dev-workflow skills will automatically use the script it creates.

## What It Does

1. **Checks for jq**: Verifies that the `jq` JSON processor is installed (required dependency)
2. **Prompts for location**: Asks whether to install globally ($HOME/.claude) or project-specific (./.claude)
3. **Creates script**: Writes the resolve_plugin_root.sh script to the chosen location
4. **Makes executable**: Sets proper permissions on the script

## Requirements

- **jq**: JSON query tool (required for the resolver script to work)
  - macOS: `brew install jq`
  - Linux: `sudo apt-get install jq`
  - Or download from: https://jqlang.github.io/jq/download/

## Usage

Use the setup skill from Claude Code:

```
Use the dev-workflow:setup skill
```

The skill will guide you through the installation process.

## Install Locations

- `$HOME/.claude` (Recommended)
- `./.claude` (Project-specific)

## After Setup

Once setup completes, you can use all other dev-workflow skills:
- `dev-workflow:run-and-fix-tests` - Run and fix tests
- `dev-workflow:write-git-commit` - Create git commits with cost metrics

Both skills will automatically find and use the resolver script.