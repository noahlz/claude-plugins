# Claude Code Dev Workflow Plugins

A collection of plugins for automating development workflow tasks:

- Build / run / fix unit tests.
- Write a git commit with Claude cost/productivity metrics.

## Project Structure

```
claude-plugins/
├── .claude-plugin/marketplace.json
├── commands/ 
│   ├── commit.md
│   └── test.md
├── skills
│   ├── write-git-commit/
│   │   ├── scripts/
│   │   └── SKILL.md
│   └── run-and-fix-tests/
│       ├── scripts/
│       └── SKILL.md
├── tests/
├── README.md
└── CLAUDE.md
```

## Plugin Authoring Guidelines

### Skill File Format (SKILL.md)

Follow the standard Anthropic Agent Skills spec:

**Frontmatter (required fields only):**
```yaml
---
name: plugin-identifier          # lowercase, hyphens only, max 64 chars
description: What it does and when to trigger. Include activation phrases.
---
```

**Body: Numbered sections with action-oriented language**
```markdown
## 1. Step Name

→ Action to take (use → symbol)
✓ Success state (use ✓ symbol)
✗ Failure/error state (use ✗ symbol)
⚠ Important note (use ⚠ symbol)
📁 File reference (use 📁 symbol)
🔧 Configuration (use 🔧 symbol)
```

**Characteristics:**
- Numbered markdown sections (## 1., ## 2., etc.)
- LLM-friendly: 
  - Imperative - written as instructions, NOT documentation.
  - Concise, symbol-based, minimal prose
- Include activation triggers in description
- Clear success/failure branches
- Code examples in backticks
- External shell scripts for complex operations.

### Plugin Conventions

- **Activate phrase**: Include in skill description (e.g., "Activate when user says 'run tests'")
- **User confirmation**: Use `AskUserQuestion` for destructive operations (e.g., fixing code automatically)
- **Task Tracking**: Use `TodoWrite` when tracking tasks in a complex skill operation.
- **Configuration**: Use default JSON config files + deep merge with user-specific JSON config using `jq`
- **Error handling**: Display errors clearly, show log file paths, ask before proceeding

## Adding New Plugin

1. **Create structure:**
   ```bash
   mkdir -p skills/my-skill/{scripts}
   mkdir -p commands
   ```

2. **Create skills/my-skill/SKILL.md** with:
   - Proper frontmatter (`name`, `description` only)
   - Numbered sections (## 1., ## 2., ...)
   - Symbol-based workflow (→, ✓, ✗, ⚠, 📁, 🔧)
   - Action-oriented language

3. **Create skills/my-skill/README.md** with user documentation

4. **Create skills/my-skill/<config>.json** with default configuration

5. **Create commands/<skill-name>.md** that invoke the skill

6. **Add to .claude-plugin/marketplace.json:**
   ```json
   {
     "name": "dev-workflow",
     "version": "0.0.1",
     "license": "MIT",
     "description": "...",
     "source": "./",
     "skills": [
       "./skills/my-skill"
     ],
     "commands": [
       "./commands/my-command.md"
     ]
   }
   ```

## Testing

The `tests/` directory contains [`shUnit2`](https://github.com/kward/shunit2) unit tests for the various scripts used by these plugins.

To run all tests:

```bash
./tests/run-all-tests.sh
```

Read @tests/README.md for detailed testing documentation.

## Communication Guidelines

When working with Claude Code on this project:

- **During implementation**: Keep explanations terse and focused
- **After plan completion**: Provide only a brief summary of what was accomplished
- **Avoid verbose output**: Don't explain each step or repeat what was already done
- **Be concise**: Use bullet points for multiple items rather than full sentences
- **Focus on results**: Let code and test results speak for themselves
- **Don't auto-commit**: Let the user trigger git commit with `/commit` when ready - don't create commits automatically

Example of preferred summary after implementation:
```
✅ Implementation complete
- Added 3 new test cases
- All 93 tests passing
- Updated SKILL.md with new workflow
```

Rather than detailed walk-throughs of each change made.


## Important References

- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/) - Official plugins maintained by Anthropic.
