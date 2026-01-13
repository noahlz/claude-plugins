# Build Configuration Setup - First Run Only

Execute ONLY if config check failed (non-zero exit code from step 1).

## Auto-Detection and Selection

→ Execute detection script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/detect-and-resolve.js" "{{SKILL_BASE_DIR}}/../.."
```

**What this does:**
- Scans project for build tool config files (package.json, pom.xml, build.gradle, etc.)
- Detects which tools are present
- Outputs JSON array of detected tools with configurations

## Auto-Selection Rules

→ Script applies these rules automatically:
- **Exactly 1 tool detected** → Use `assets/defaults/{tool}.json`
- **No matching default exists** → Use `assets/defaults/TEMPLATE.json` placeholder template (user must customize)
- **0 tools detected** → Error: no build tools detected

## Result Handling

✓ Exit 0 → Config created at `.claude/settings.plugins.run-and-fix-tests.json`, proceed to step 2  
✗ Exit 1 → No tools detected, display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Placeholder template used, display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  

## Exit Codes

- 0: Config successfully created
- 1: No tools detected, user must create config manually
- 2: Placeholder template used, user must customize
