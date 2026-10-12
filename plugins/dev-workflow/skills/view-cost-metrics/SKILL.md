---
name: view-cost-metrics
description: Display current session cost metrics. Use when the user asks to see current costs, cost usage, or how much the session has cost so far.
effort: low
argument-hint: "[incremental|inc|cumulative|cum]"
allowed-tools:
  - Bash(node *)
  - Read
  - Grep

---

Use this skill to display current session cost metrics without creating a commit.

**MANDATORY** only activate this skill when the user invokes it directly (`/view-cost-metrics`) OR asks about current session costs.

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

**Node.js Check**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/check-node-version.js"`

⛔ **HALT** if Node.js Check shows `ERROR`.

**Dependencies**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/check-dependencies.js" "${CLAUDE_PLUGIN_ROOT}"`

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

**SKILL_NAME**: view-cost-metrics

**MODE**: Determine from `$ARGUMENTS`: if it contains "cumulative" or "cum" → `cumulative`; otherwise → `incremental` (default, also matches "incremental" or "inc")

**SKILL_CONFIG**: !`node "${CLAUDE_PLUGIN_ROOT}/lib/skill-config.js" check view-cost-metrics`

**Configuration Routing:**
- If `SKILL_CONFIG` starts with `✓ Configuration found` → Step 1a
- If `SKILL_CONFIG` starts with `NOT_CONFIGURED` → Step 1b

Config lives at the project root. Access it only via `skill-config.js`, never by relative path.

## 1. Resolve SessionID

### 1a. Load existing configuration

→ Step 2 (`--config` reads the project config).

### 1b. Create new configuration

→ **MANDATORY:** Tell the user: "⚠️  Skill configuration not found! ({{path from SKILL_CONFIG}}). Let's create it:"

→ Run Bash command to list available sessions:
```bash
node "{{SKILL_BASE_DIR}}/scripts/cost-workflow.js" list-sessions
```

→ Parse JSON output: Extract sessions array from `data.sessions` field.
→ Use AskUserQuestion to ask user "Select a Claude Code session:" with options from first 4 sessions.
→ Extract selected session ID and store in `SESSION_ID` variable.

→ Write config file:
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/skill-config.js" write view-cost-metrics '{"sessionId":"{{SESSION_ID}}"}'
```

→ `created` → inform user of `path`. `exists` → keep it; never overwrite. Step 2.

## 2. Fetch Cost Data

**STEP_DESCRIPTION**: "Fetching session cost metrics"

→ Execute using Bash tool:
```bash
node "{{SKILL_BASE_DIR}}/scripts/cost-workflow.js" fetch-cost --config --mode {{MODE}}
```

→ Parse JSON output.

DELEGATE_TO: `references/display_costs.md`
⛔ READ FILE AND FOLLOW INSTRUCTIONS, THEN RETURN HERE

## 3. Display Summary

**STEP_DESCRIPTION**: "Displaying cost metrics"

→ Display cost metrics to user in the format from display_costs.md.
→ Return to user.
