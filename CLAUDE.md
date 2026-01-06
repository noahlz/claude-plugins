# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins).

## Project Structure

```
claude-plugins/
├── .claude-plugin/
├── plugins/
│   └── dev-workflow/
│       ├── agents/
│       ├── commands/
│       ├── common/
│       └── skills/
│           ├── lib/
│           ├── run-and-fix-tests/
│           │   ├── assets/
│           │   │   └── defaults/
│           │   ├── references/
│           │   └── scripts/
│           ├── setup/
│           └── write-git-commit/
│               └── scripts/
└── test/
    ├── dev-workflow/
    │   ├── fixtures/
    │   │   ├── configs/
    │   │   ├── cost-arrays/
    │   │   ├── metrics/
    │   │   └── project-templates/
    │   ├── lib/
    │   │   └── mocks/
    │   ├── run-and-fix-tests/
    │   └── write-git-commit/
    └─ lib/
```

## Development Philosophy

### Move Fast and Break Things

*This plugin is in early stages!* You do **NOT* have to worry about backwards compatability when adding enhancements or refactoring.

### Script-First Approach

- Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under a sibling `lib/` directory i.e. `plugins/dev-workflow/skills/lib`
- Skills and agents should orchestrate existing scripts, not generate or run improvised logic.
- Write Node.js tests for scripts, placing them under `test/dev-workflow/` in directories named for the corresponding skills and plugins.
- This keeps workflows testable, maintainable, and predictable.

**IMPORTANT** Remember that environment variables (i.e. set via `export KEY=VALUE`) do not presist between Bash tool invocations. Therefore, Scripts or Bash commands that call scripts **MUST** output values to the console (stdout) i.e. `echo KEY=VALUE` for the skill to use later.  

### Testing Approach

Use this project's own plugin `dev-workflow:run-and-fix-tests` for regression testing changes and fixing bugs.

### Dependencies

`ccusage` - Usage analysis library for Claude Code sessions, installed as devDependency for testing

  - Provides programmatic access to session data, token costs, and usage metrics
  - Used by `write-git-commit` skill to fetch and embed cost metrics in git commits
  - Documentation: https://ccusage.com/guide/library-usage

## NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.

Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.

---

## APPENDIX: Important References

- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)
