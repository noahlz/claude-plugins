# Build Configuration Setup - First Run Only

Execute ONLY if config check failed (non-zero exit code from step 1).

## Auto-Detection and Selection

→ Execute detection script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/detect-and-resolve.js" "{{SKILL_BASE_DIR}}/../.."
```

## Auto-Selection Rules

→ Selection rules:
- **Exactly 1 tool detected** → Use `assets/defaults/{tool}.json`
- **No matching default exists** → Use `assets/defaults/TEMPLATE.json` placeholder template (user must customize)
- **0 tools detected** → Error: no build tools detected

## Result Handling

✓ Exit 0 → Config created at `.claude/settings.plugins.run-and-fix-tests.json`. Resume skill workflow.  
✗ Exit 1 → No tools detected, display error: "No build tools found. Create `.claude/settings.plugins.run-and-fix-tests.json` manually"  
⚠️ Exit 2 → Placeholder template used, display warning: "Placeholder config created. Edit `.claude/settings.plugins.run-and-fix-tests.json` before proceeding"  