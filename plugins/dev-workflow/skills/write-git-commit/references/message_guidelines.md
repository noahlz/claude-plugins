# Commit Message Guidelines

## Overview

Generate a commit message with imperative mood subject line and optional bullet point body.

## General Guidelines

- Follow any user direction / customizations from their prompt i.e. "write a git commit summarizing this refactoring."
- *DO NOT* Include metrics obtainable from a git diff or CI/CD logs, such as files edited, count or % of lines of code added/removed, or count of passing tests
- **Important: Incorporate user feedback** If this is revision of a previously-generated commit body, take into account any user feedback on the previous iteration.

## Subject Line

**Format:** Action verb + brief description (imperative mood, max 72 chars)

**Examples:**
- "Add dark mode toggle"
- "Fix authentication bug"
- "Refactor user service"

## Body (Optional)

**Default: No body** - Prefer summary-only commits when possible

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

## Next Step

Return to SKILL.md with generated message stored internally.
