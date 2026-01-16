# Build Configuration Setup - First Run Only

Execute ONLY if build configuration is missing (SKILL_CONFIG: NOT_CONFIGURED)

**Contents:**
- Auto-Detection and Selection
- Auto-Selection Rules
- Result Handling

## Auto-Detection and Selection

→ Execute detection and config creation:
```bash
# Step 1: Detect build tools
DETECTED=$(node "{{SKILL_BASE_DIR}}/scripts/detect-and-resolve.js" "{{SKILL_BASE_DIR}}/../..")

# Step 2: Create config file in project's .claude/ directory
node "{{SKILL_BASE_DIR}}/scripts/select-default.js" "{{SKILL_BASE_DIR}}/../.." "$DETECTED" "$(pwd)"
```

## Auto-Selection Rules

→ Selection rules:
- **Exactly 1 tool detected** → Use `assets/defaults/{tool}.json`
- **No matching default exists** → Use `assets/defaults/TEMPLATE.json` placeholder template (user must customize)
- **0 tools detected** → Error: no build tools detected.
- **Polyglot project detected** →  Error: Exit workflow and return to user.

## Result Handling

✓ Exit 0 → Config created at `.claude/settings.plugins.run-and-fix-tests.json`. Display message to user and exit workflow.  
✗ Exit 1 → Error occurred. Exit workflow.  
⚠️ Exit 2 → Placeholder template used. Display warning to user and exit workflow.  

## User Instructions (Display After Config Creation)

**After successful config creation (Exit 0 or Exit 2), display this message to the user:**

---

⚠️ **Configuration created at:** `.claude/settings.plugins.run-and-fix-tests.json`

📋 **Next steps:**  
1. Review the generated config file (path above) to ensure build/test commands match your project
2. Make any necessary edits to the config
3. Run `/test` again after making changes

---

**NOTE:** This skill does not yet support "polyglot" (multi-build language/build tool) projects. If you encounter this, inform the user of the limitation and exit the workflow.
