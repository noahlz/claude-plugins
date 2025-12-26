# Claude Code Plugins

A collection of Claude Code [plugins](https://code.claude.com/docs/en/plugins).

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
│           │   ├── defaults/   # Default configurations for various languages / build systems.
│           │   └── scripts/
│           └── write-git-commit/
│               └── scripts/
└── tests/                      # Test suite (separate from plugin source)
```

## Development Philosophy

**Script-First Approach**: 
- Prefer writing and invoking pre-existing scripts over dynamic code generation or ad-hoc commands.
- When writing new scripts, keep code DRY with shared scripts under a sibling `lib/` directory i.e. `plugins/dev-workflow/skills/lib`
- Skills and agents should orchestrate existing scripts, not generate or run improvised logic.
- This keeps workflows testable, maintainable, and predictable.

## NOTE: Reinstall After Changing

When modifying or debugging scripts **prompt the user to re-install the plugin**.  Changes do not take effect immediately. The user needs to exit the session, run the provided `./reinstall.sh` script, and restart the session.

## Testing

Plugin test suites reside under `tests/`

---

## APPENDIX: Important References

- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Anthropic Agent Skills Spec](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Marketplaces Reference](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplaces)

## APPENDIX: Adding a New Plugin

Place new plugins under the `plugins/` directory:

```bash
plugins/
├── dev-workflow/          # Existing plugin
└── my-plugin/             # New plugin
    ├── agents/
    ├── commands/
    └── skills/
```

Also:
- Examine the existing plugins for conventions and structure.
- Add the plugin registration to `.claude-code/markeplace.json`.
