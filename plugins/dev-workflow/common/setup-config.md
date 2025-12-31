# Build Configuration Setup - First Run Only

Execute ONLY if config check failed (exit 1 from Section 1).

Parameters required:
- CLAUDE_PLUGIN_ROOT: Plugin root path (already exported from Section 0)

## Auto-Detection and Selection

→ Execute detection script:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/run-and-fix-tests/scripts/detect-and-resolve.js "${CLAUDE_PLUGIN_ROOT}"
```

**What this does:**
- Scans project for build tool config files (package.json, pom.xml, build.gradle, etc.)
- Detects which tools are present
- Outputs JSON array of detected tools with configurations

## Auto-Selection Rules

→ Script applies these rules automatically:
- **Exactly 1 tool detected** → Use `defaults/{tool}.json`
- **Multiple tools in different locations** → Generate polyglot config (🔧 shown to user)
- **Multiple tools in same location** → Generate polyglot config
- **No matching default exists** → Use `TEMPLATE.json` placeholder template (user must customize)
- **0 tools detected** → Error: no build tools detected

## Result Handling

✓ Exit 0 → Config created at `.claude/settings.plugins.run-and-fix-tests.json`, proceed to Section 2

✗ Exit 1 → No tools detected, display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"

⚠️ Exit 2 → Placeholder template used, display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"

## Exit Codes

- 0: Config successfully created
- 1: No tools detected, user must create config manually
- 2: Placeholder template used, user must customize
