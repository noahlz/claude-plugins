# Extract and Validate SKILL_BASE_DIR

**MANDATORY FIRST STEP - DO NOT PROCEED WITHOUT COMPLETING THIS**

---

## Extract SKILL_BASE_DIR

→ Extract `SKILL_BASE_DIR` from Claude Code's "Base directory for this skill:" message at skill startup.
→ Display the extracted path to confirm it was captured correctly.
→ Verify the path contains `.claude/plugins/cache/` - this is the installed plugin location.

**Example:**
```
Base directory for this skill: /Users/noahlz/.claude/plugins/cache/noahlz-github-io/dev-workflow/0.2.0/skills/write-git-commit
```

→ If SKILL_BASE_DIR is missing or doesn't contain `.claude/plugins/cache/`: HALT - display error and exit workflow.

---

## Critical Path Requirements

**ALWAYS use `{{SKILL_BASE_DIR}}` in all script paths throughout this workflow.**

**Why this matters:**
- The installed plugin directory contains `node_modules/ccusage`
- The source project directory does NOT have node_modules
- Running scripts from wrong paths causes "Cannot find package 'ccusage'" errors

**Correct path pattern:**
```bash
node "{{SKILL_BASE_DIR}}/scripts/commit-workflow.js" ...
```

**WRONG patterns to NEVER use:**
```bash
# ❌ Source project paths
node plugins/dev-workflow/skills/write-git-commit/scripts/commit-workflow.js
node ./skills/write-git-commit/scripts/commit-workflow.js
```

---

Return to SKILL.md with SKILL_BASE_DIR value stored.
