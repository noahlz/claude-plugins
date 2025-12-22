# Claude Code Dev Workflow Plugins

A collection of plugins for automating development workflow tasks.

## Project Structure

```
claude-plugins/
├── .claude-plugin/marketplace.json
├── agents/
│   └── test-runner-fixer.md
├── commands/
│   ├── commit.md
│   └── test.md
├── skills/
│   ├── run-and-fix-tests/
│   │   ├── examples/
│   │   ├── scripts/
│   │   └── SKILL.md
│   └── write-git-commit/
│       ├── scripts/
│       └── SKILL.md
├── tests/
├── README.md
└── CLAUDE.md
```

## Communication Guidelines

When working on this project:

- **Explain Steps**: Keep the user informed as you work i.e. "Making edits to <filename> to implement <feature>" or "Running ad-hoc commands to investigate the bug"
- **Be concise**: Use terse sentences or bullet points for multiple items rather than a paragraph explanation.
- **After plan completion**: Provide only a brief summary of what was accomplished
- **Don't auto-commit**: Let the user trigger git commit with `/commit` when ready - don't create commits automatically

Example of preferred summary after implementation:
```
✅ Implementation complete
- Added 3 new test cases
- All 93 tests passing
- Updated SKILL.md with new workflow
```

Rather than detailed walk-throughs of each change made.

**IMPORTANT** When running ad-hoc Bash commands:
1. Always provide a brief (single sentence) explanation of what you're doing and why, i.e. "Run the script in a /tmp directory to figure out why it's failing"
2. Even if permissions allow running a Bash tool command, always ask the user before running potentially destructive commands.

## Development Workflow

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

### Agents (`agents/<agent-name>.md`)

Autonomous decision-makers that coordinate plugin workflows. Agents:
- Use decision-making frameworks instead of step-by-step instructions
- Invoke skills to perform actual work
- Include safeguards (e.g., `AskUserQuestion` before destructive actions)
- Reference skill execution, not duplicate their logic

### Skills (`skills/<name>/SKILL.md`)

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

### Commands (`commands/<name>.md`)

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

Scripts live in `skills/<name>/scripts/`:
- Each script handles a specific concern (e.g., `load-config.sh`, `detect-and-resolve.sh`)
- Scripts are tested individually via files in `tests/<name>/`
- Tests use shUnit2 framework with mocks for external commands

## Important References

- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/) - Official plugins maintained by Anthropic.

---

## APPENDIX: Creating New Plugins

This project primarily focuses on maintaining and developing existing plugins. New plugin creation is rare but follows this structure:

1. Create directories:
   ```bash
   mkdir -p skills/my-skill/{scripts}
   ```

2. Create `skills/my-skill/SKILL.md` following the format above

3. Create `skills/my-skill/README.md` with user documentation

4. Add test files in `tests/my-skill/test-*.sh`

5. Create `commands/my-command.md` that invokes the skill (optionally with an agent)

6. Register in `.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "dev-workflow",
     "skills": ["./skills/my-skill"],
     "commands": ["./commands/my-command.md"]
   }
   ```

For detailed guidelines, refer to the Anthropic Agent Skills Spec linked above.
