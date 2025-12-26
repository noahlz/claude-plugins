# Claude Code Dev Workflow Plugins

A collection of plugins for automating development workflow tasks.

## Project Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json        # Plugin marketplace definition
├── plugins/
│   └── dev-workflow/           # Plugin source code (same structure when installed)
│       ├── agents/
│       ├── commands/
│       └── skills/
│           ├── lib/            # Shared utilities for all skill scripts
│           ├── run-and-fix-tests/
│           │   ├── examples/
│           │   └── scripts/
│           └── write-git-commit/
│               └── scripts/
└── tests/                      # Test suite (separate from plugin source)
```

### Running Tests

Use the `/test` command to validate changes. This invokes the `run-and-fix-tests` skill with the **test-runner-fixer agent**, which automatically:
- Detects your project structure
- Runs the full test suite
- Identifies failures
- Suggests and implements fixes
- Re-runs tests until all pass

```bash
/test
```

**If the `run-and-fix-tests` skill is unavailable:** halt the workflow and inform the user that you are unable to proceed, and that they will need to install the plugin or manually run/fix the broken tests.

## Understanding Plugin Architecture

Plugins consist of three main components:

### Agents (`plugins/dev-workflow/agents/<agent-name>.md`)

Autonomous decision-makers that coordinate plugin workflows. Agents:
- Use decision-making frameworks instead of step-by-step instructions
- Invoke skills to perform actual work
- Include safeguards (e.g., `AskUserQuestion` before destructive actions)
- Reference skill execution, not duplicate their logic

### Skills (`plugins/dev-workflow/skills/<name>/SKILL.md`)

Procedural workflows that follow the Anthropic Agent Skills spec:

**Frontmatter:**
```yaml
---
name: plugin-identifier          # lowercase, hyphens only, max 64 chars
description: What it does and when to trigger. Include activation phrases.
---
```

**Body: Numbered action-oriented sections:**
```markdown
## 1. Step Name

→ Action to take (use → symbol)
✓ Success state (use ✓ symbol)
✗ Failure/error state (use ✗ symbol)
⚠ Important note (use ⚠ symbol)
📁 File reference (use 📁 symbol)
🔧 Configuration (use 🔧 symbol)
```

**Style:**
- Numbered markdown sections (## 1., ## 2., etc.)
- Imperative language (instructions, not documentation)
- Concise, symbol-based, minimal prose
- Clear success/failure branches
- Code examples in backticks
- External shell scripts for complex logic

### Commands (`plugins/dev-workflow/commands/<name>.md`)

Entry points that trigger skills. Commands are invoked with `/name` and typically delegate to a skill and optional agent.

## Development Philosophy

**Script-First Approach**: Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands. Skills and agents should orchestrate existing scripts, not generate or run improvised logic. This keeps workflows testable, maintainable, and predictable.

## Maintenance Patterns

When modifying or debugging scripts:

- **Configuration**: Plugin config stored in `settings.plugins.<plugin-name>.json` (auto-detected/auto-generated on first run)
- **External dependencies**: Document with installation links (e.g., `ccusage`)
- **Task tracking**: Use `TodoWrite` when fixing multiple issues
- **User confirmation**: Use `AskUserQuestion` before destructive operations
- **Error messaging**: Display clearly, show log file paths, ask before proceeding
- **Activation phrases**: Include in skill description (e.g., "Activate when user says 'run tests'")

### Script Organization

Scripts live in `plugins/dev-workflow/skills/<name>/scripts/`:
- Each script handles a specific concern (e.g., `load-config.sh`, `detect-and-resolve.sh`)
- Scripts are tested individually via files in `tests/<name>/`
- Tests use shUnit2 framework with mocks for external commands

**Shared Utilities:** Plugin-wide bash utilities are centralized in `plugins/dev-workflow/skills/lib/common.sh`:
- `detect_plugin_root()` - Set CLAUDE_PLUGIN_ROOT from script location
- `check_jq()` - Verify jq availability
- `check_command()` - Generic command checker
- `load_and_merge_skill_config()` - Parameterized config loader (merges default + project configs)
- `json_response()`, `json_response_simple()` - JSON output helpers

Each skill's `scripts/common.sh` sources `../lib/common.sh` (relative path to the shared library) and adds skill-specific helpers:
- `write-git-commit`: `find_ccusage()`
- `run-and-fix-tests`: (none currently, but extensible)

## Important References

- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/) - Official plugins maintained by Anthropic.

---

## APPENDIX: Creating New Plugins

This project primarily focuses on maintaining and developing existing plugins. New plugin creation is rare but follows this structure:

### Plugin Structure

New plugins are added as siblings to `dev-workflow` under the `plugins/` directory:

```bash
plugins/
├── dev-workflow/          # Existing plugin
└── my-plugin/             # New plugin
    ├── agents/
    ├── commands/
    └── skills/
```

### Creating a New Skill within a Plugin

1. Create skill directories:
   ```bash
   mkdir -p plugins/my-plugin/skills/my-skill/{scripts}
   ```

2. Create `plugins/my-plugin/skills/my-skill/SKILL.md` following the format in the Skills section above

3. Create `plugins/my-plugin/skills/my-skill/README.md` with user documentation

4. Add test files in `tests/my-plugin/my-skill/test-*.sh`

5. Create `plugins/my-plugin/commands/my-command.md` that invokes the skill (optionally with an agent)

6. Register in `.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "my-plugin",
     "skills": ["./plugins/my-plugin/skills/my-skill"],
     "commands": ["./plugins/my-plugin/commands/my-command.md"]
   }
   ```

### Plugin Installation

When installed, the plugin is copied to `~/.claude/plugins/cache/<publisher>/<plugin>/<version>/` with the same directory structure. The `resolve_plugin_root.sh` script automatically locates the installed plugin path at runtime.

For detailed guidelines, refer to the Anthropic Agent Skills Spec linked above.
