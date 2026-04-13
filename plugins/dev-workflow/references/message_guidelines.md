# Commit Message Guidelines

**SILENCE PROTOCOL**: Do NOT output anything from this file. Store variables silently. The first visible output is the `Proposed commit message:` block in the approval step.

---

Generate COMMIT_SUBJECT (imperative subject line) and COMMIT_BODY (optional bullets) from:
- Most recent `git diff` in context
- Any relevant intent or goals from the current session

## General Guidelines

- Follow any user direction / customizations from their prompt i.e. "write a git commit summarizing this refactoring."
- **IMPORTANT:** Do NOT include metrics obtainable from a git diff or CI/CD logs, such as files edited, count or % of lines of code added/removed, or count of passing tests.
- **IMPORTANT:** Incorporate user feedback. If this is revision of a previously-generated commit body, take into account any user feedback on the previous iteration.

## Subject Line

Store as COMMIT_SUBJECT. **Format:** Action verb + brief description (imperative mood, max 72 chars)

**Examples:**
- "Add dark mode toggle"
- "Fix authentication bug"
- "Refactor user service"

## Body (Optional)

Store as COMMIT_BODY. **Default: No body** — prefer summary-only when possible.

**When to omit body (summary-only):**
- Change is straightforward and well-described by subject line
- User explicitly requested, i.e. "commit with just a summary"

**When to add body (bullets):**
- Multiple files with different types of changes
- Single file but changes span multiple unrelated areas
- Complex change requiring context beyond subject

**Bullet guidelines (when used):**
- Minimum: 2 bullets (if fewer, use summary-only instead)
- Maximum: 4 bullets
- Each bullet: focus on "what changed" and "why" - not "how"
- Each bullet should add meaningful context not obvious from subject

---

## Examples

**Feature:**
```
Add JWT-based authentication

- Implement login endpoint with token generation
- Add middleware for token validation
```

**Bug fix:**
```
Fix date formatting in timezone conversion

- Use UTC timestamps in report generation
```

**Refactoring:**
```
Refactor error handling and update dependencies

- Standardize error response format
- Upgrade lodash to 4.17.21
```

