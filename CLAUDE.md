# CLAUDE.md

## Project Structure

```
claude-plugins/
├── .claude-plugin/marketplace.json     # Marketplace metadata
├── plugins/
│   ├── write-git-commit/
│   │   ├── plugin.json                 # Plugin config (name, version, author)
│   │   ├── README.md                   # User-facing documentation
│   │   ├── commands/commit.md          # Command files invoke skills
│   │   └── skills/SKILL.md             # Agent skill (numbered steps)
│   └── run-and-fix-tests/
│       ├── plugin.json
│       ├── README.md
│       ├── build-config.json           # Default build/test config
│       ├── commands/test.md
│       ├── skills/SKILL.md
│       └── scripts/load-build-config.js # Config loading utility
├── README.md                           # Marketplace overview
└── CLAUDE.md                           # This file
```

## Plugin Authoring Guidelines

### Skill File Format (SKILL.md)

Follow [Anthropic Agent Skills spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure).

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
- **Configuration**: Use JSON config files + deep merge strategy
- **Error handling**: Display errors clearly, show log file paths, ask before proceeding

## Adding New Plugin

1. **Get author info from git config:**
   ```bash
   git config user.name   # Use for plugin.json "author"
   git config user.email  # Use for marketplace.json if needed
   ```

2. **Create structure:**
   ```bash
   mkdir -p plugins/my-plugin/{skills,commands,scripts}
   ```

3. **Create plugin.json** with metadata

4. **Create skills/SKILL.md** with:
   - Proper frontmatter (`name`, `description` only)
   - Numbered sections (## 1., ## 2., ...)
   - Symbol-based workflow (→, ✓, ✗, ⚠, 📁, 🔧)
   - Action-oriented language

5. **Create commands/** that invoke the skill

6. **Create README.md** with user documentation

7. **Add to marketplace.json:**
   ```json
   {
     "name": "my-plugin",
     "source": "./plugins/my-plugin",
     "description": "...",
     "version": "0.0.1",
     "author": {"name": "..."},
     "keywords": [...],
     "category": "development"
   }
   ```

## Important References

- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
