---
name: write-git-commit
description: Create a git commit with Claude Code session cost metrics and attribution embedded as git trailers. Activate when user mentions "commit", "commit my changes", "commit this", "save to git", "check in".

---

This skill creates a git commit with a summary and optional body consisting for terse bullet points and git trailers for attribution and Claude cost metrics.

Activate when the user explicitly requests a git commit using phrases like:
- "commit my changes"
- "commit this"
- "save to git"
- "git commit"

---

## Workflow Rules & Guardrails

**FOLLOW THESE RULES FOR THE ENTIRE WORKFLOW. Violations break the workflow.**

### A. Workflow Prerequisites Chain

- DO NOT SKIP any section.
- MUST obtain user approval via AskUserQuestion in Section 1e before proceeding to Section 2.
- Do NOT proceed to Section 3 until Section 2 completes successfully.

### B. Workflow Narration

ALWAYS use "Step" instead of "Section" when narrating each step in this workflow. 
- Yes: "Step 1. Generate and Approve Commit Message"
- No: "Section 1. Generate and Approve Commit Message"

---

## 0. Prerequisites

**SKILL_NAME**: write-git-commit

**CLAUDE_PLUGIN_ROOT**: !`if [ -x "$HOME/.claude/resolve_plugin_root.sh" ]; then $HOME/.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; elif [ -x "./.claude/resolve_plugin_root.sh" ]; then ./.claude/resolve_plugin_root.sh "dev-workflow@noahlz.github.io"; else echo "⚠️ Run dev-workflow:setup to install resolver"; fi`

**SESSION_ID**: !`cat .claude/settings.plugins.write-git-commit.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).sessionId' || echo "NOT_CONFIGURED"`

---

✗ If you see "⚠️ Run dev-workflow:setup" above, a key prerequisite has failed → Exit this skill immediately.  
✓ If prerequisites are met, read instructions from `references/variable_rules.md` for MANDATORY environment variable scoping requirements.

**NOTE:** If you see "NOT_CONFIGURED" above, the sessionId will be resolved and saved to configuration in a later step.  

**⚠️ CRITICAL: HOW TO EXECUTE BASH CODE IN THIS SKILL**

When you see inline bash code blocks (```bash), you MUST:
- MUST FIRST place the skill variables `__PLUGIN_ROOT__` and `__SESSION_ID__` with their literal values.
- MUST execute the modified code block using the Bash tool
- NEVER narrate execution. ALWAYS execute the code block command
- NEVER fabricate outputs (i.e. if the tool / command fails)
 
 ## 1. Generate and Approve Commit Message

✗### 1a. Stage changes

**Step description**: "Staging all uncommitted changes"

→ Execute using Bash tool:
```bash
git add -A
```

### 1b. Analyze staged changes

**Step description**: "Analyzing staged changes"

→ Execute using Bash tool:
```bash
git diff --cached
```

### 1c. Generate a Commit Message

**Step description**: "Generating commit message"

Generate a commit message based on diff changes and the current chat context, but do not display it to the user yet.

Read `references/message_guidelines.md` for MANDATORY instructions on crafting a commit message.

### 1d. Display the Proposed Message

Read `references/message_display.md` for MANDATORY instructions on displaying the message to the user.

### 1e. Obtain User Approval or Revisions

⚠️ CRITICAL DECISION POINT: This step MUST be completed before any further action

Read `references/user_approval.md` for MANDATORY instructions on obtaining user approval.

## 2. Fetch Cost Data

Read `references/fetch_cost.md` for MANDATORY instructions on obtaining cost data. 

**⚠️ N️OTE:** Do NOT ever make a commit with missing or contrived/estimated cost metrics. If you are encountering errors with `ccusage`, IMMEDIATELY stop the workflow ask the User for guidance.

## 3. Create Commit

Read `references/create_commit.md` for MANDATORY instructions on creating the git commit.

## 4. Summary 

→ Display success summary:
```
✅ Commit created with session cost metrics in footer
   SHA: `COMMIT_SHA`

📊 Session metrics:
   ID: `SESSION_ID`
   (for each model in `CURRENT_COST`): "   - {model}: {inputTokens} in + {outputTokens} out = ${cost}"
```

✓ Done - Return to user
