---
name: cost-tracker
description: Display current session cost metrics. Use when the user asks to see current costs, cost usage, or how much the session has cost so far.
context: fork
allowed-tools:
  - Bash(node *)
  - Read
  - Grep

---

Use this skill to display current session cost metrics without creating a commit.

**MANDATORY** only activate this skill when the user invokes it directly (`/cost-tracker`) OR asks about current session costs.

Follow the workflow steps EXACTLY.

---

# Skill Workflow Checklist

```
- [ ] 0. Prerequisites
- [ ] 1. Resolve SessionID
- [ ] 2. Fetch cost data
- [ ] 3. Display costs
```

---

# Skill Context

**SKILL_BASE_DIR**: `${CLAUDE_SKILL_DIR}`

⛔ **VERSION CHECK**: If `SKILL_BASE_DIR` above shows literal `${CLAUDE_SKILL_DIR}` instead of a real path, halt: "This skill requires Claude Code 2.1.69 or higher."

**Node.js Check**: !`node -e "process.exit(parseInt(process.version.slice(1)) >= 22 ? 0 : 1)" 2>/dev/null && echo "✓ Node.js $(node -v)" || echo "ERROR: Node.js 22+ required (found: $(node -v 2>/dev/null || echo 'not installed')). Install: https://nodejs.org/"`

⛔ **HALT** if Node.js Check shows `ERROR`.

**Dependencies**: !`[ -d "${CLAUDE_SKILL_DIR}/../../node_modules" ] || (npm install --prefix "${CLAUDE_SKILL_DIR}/../.." --silent 2>&1 && echo "Plugin dependencies installed." || echo "WARNING: Failed to install plugin dependencies.")`

## Workflow Rules & Guardrails

**MANDATORY:** FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW.

### A. Narration Control

⚠️  **SILENCE PROTOCOL**
Only narrate steps with a STEP_DESCRIPTION field. Execute all other steps and tool calls silently - no explanatory text.

### B. JSON Response Protocol

All script outputs return JSON. Extract fields and store in variables.

---

# Skill Workflow Instructions

## 0. Prerequisites

**SKILL_NAME**: cost-tracker

**SKILL_CONFIG**: !`[ -f "./.claude/settings.plugins.cost-tracker.json" ] && echo "✓ Configuration found" || echo "NOT_CONFIGURED"`

**Configuration Routing:**
- If `SKILL_CONFIG` = `✓ Configuration found` → Proceed to Step 1a (Load Configuration)
- If `SKILL_CONFIG` = `NOT_CONFIGURED` → Skip Step 1a, proceed to Step 1b (Create Configuration)

## 1. Resolve SessionID

### 1a. Load existing configuration

→ Execute using Bash tool:
```bash
cat .claude/settings.plugins.cost-tracker.json
```

→ Parse JSON output and extract `sessionId` field value
→ Store as SESSION_ID for use in subsequent steps
→ Proceed to Step 2

### 1b. Create new configuration

→ **MANDATORY:** Tell the user: "⚠️  Skill configuration not found! (./.claude/settings.plugins.cost-tracker.json). Let's create it:"

→ Run Bash command to list available sessions:
```bash
node "{{SKILL_BASE_DIR}}/scripts/cost-workflow.js" list-sessions
```

→ Parse JSON output: Extract sessions array from `data.sessions` field.
→ Use AskUserQuestion to ask user "Select a Claude Code session:" with options from first 4 sessions.
→ Extract selected session ID and store in `SESSION_ID` variable.

→ Write config file:
```bash
echo '{"sessionId":"{{SESSION_ID}}"}' > .claude/settings.plugins.cost-tracker.json
```

→ Inform the user of the file location and continue to Step 2.

## 2. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

→ Execute using Bash tool:
```bash
node "{{SKILL_BASE_DIR}}/scripts/cost-workflow.js" fetch-cost "$(pwd)" "{{SESSION_ID}}"
```

→ Parse JSON output.

DELEGATE_TO: `references/display_costs.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

## 3. Display Summary

**STEP_DESCRIPTION**: "Displaying cost metrics"

→ Display cost metrics to user in the format from display_costs.md.
→ Return to user.
