# Build Configuration Setup - First Run Only

Execute ONLY if build configuration is missing (SKILL_CONFIG: NOT_CONFIGURED)

**Contents:**
- Auto-Detection and Selection
- Auto-Selection Rules
- Result Handling

## Auto-Detection and Selection

→ Execute detection script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/detect-and-resolve.js" "{{SKILL_BASE_DIR}}/../.."
```

## Auto-Selection Rules

→ Selection rules:
- **Exactly 1 tool detected** → Use `assets/defaults/{tool}.json`
- **No matching default exists** → Use `assets/defaults/TEMPLATE.json` placeholder template (user must customize)
- **0 tools detected** → Error: no build tools detected.
- **Polyglot project detected** →  Error: Exit workflow and return to user.

## Result Handling

✓ Exit 0 → Config created at `.claude/settings.plugins.run-and-fix-tests.json`. Resume skill workflow.  
✗ Exit 1 → No tools detected, display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Placeholder template used, display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  

**NOTE:** This skill does not yet support "polyglot" (multi-build language/build tool) projects. If you encounter this, inform the user of the limitation and exit the workflow.
