# Stage and Analyze Changes

**Contents:**
- Stage Changes
- Analyze Staged Changes
- Return to Main Workflow

---

**IMPORTANT:** Only run the git commands below. Do **NOT** run other git commands such as "git log --oneline" (previous commits are irrelevant).

## Stage Changes

**STEP_DESCRIPTION**: "Staging changes"

> Execute using Bash tool:
```bash
git add -A
```

## Analyze Staged Changes

**STEP_DESCRIPTION**: "Generating commit message"

**Generate commit message using ONE of these approaches:**

1. **IF you made source code edits in this conversation:** Use your existing knowledge of the changes to draft the commit message directly. Skip the git diff command.

2. **IF you have NOT made edits in this conversation:** Run `git diff --cached` to see what will be committed:
   ```bash
   git diff --cached
   ```
   Then use that output to generate the commit message.

Proceed to the next step in the main workflow to draft the message according to the guidelines.
