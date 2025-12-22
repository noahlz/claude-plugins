# Claude Code Dev Workflow Plugins

A collection of plugins for automating development workflow tasks:

- Build / run / fix unit tests.
- Write a git commit with concise summary and git trailers for Claude attribution and cost/productivity metrics.

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

## Plugin Authoring Guidelines

### Agent Definitions

**File location:** `agents/<agent-name>.md`

**Guidelines:**
- Separate agent approach/guidance from skill procedural steps
- Use decision-making frameworks instead of step-by-step instructions
- Include safeguards (e.g., asking permission before destructive actions)
- Reference skills the agent will invoke, not replicate their workflows

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
- **Configuration**: Use `settings.plugins.<plugin-name>.json` for project-specific config (auto-detected/auto-generated on first run preferred)
- **Dependencies**: Document external tool requirements with installation links (e.g., ccusage)
- **Error handling**: Display errors clearly, show log file paths, ask before proceeding
- **Fallback methods**: For external tools, try direct invocation, then npx, then bunx

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

After making changes to plugin scripts, use the `run-and-fix-tests` skill (if it is available).

If the plugin is not available, follow these steps:

1. Run all tests with the command:

```bash
./tests/run-all-tests.sh > ./out/tests.log > 2>&1
```

2. Check the return code of the command.
- If it is zero, all tests pass! Stop.
- If it is non-zero, proceed to the next step.

3. Fix the broken tests:
- Search the contents of `./out/tests.log` for `fail` (case insensitive) to identify the failing tests.
- Create a todo list of the failures with `TodoWrite`
- Iterate the failing tests, fixing each. Mark todo list item as `completed` when fixed.

Read @tests/README.md for detailed testing documentation.

## Communication Guidelines

When working on this project:

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

**IMPORTANT** When running ad-hoc Bash commands:
1. Always provide a brief (single sentence) explanation of what you're doing and why, i.e. "Run the script in a /tmp directory to figure out why it's failing"
2. Even if permissions allow running a Bash tool command, always ask the user before running potentially destructive commands.

## Important References

- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/) - Official plugins maintained by Anthropic.
