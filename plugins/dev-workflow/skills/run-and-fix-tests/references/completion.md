# Completion and Summary Procedure

## Prerequisites

- Test execution completed (either all passed or fixing attempted)
- Workflow reached final stage

---

## Status Check

→ Determine completion status:
- All originally-failing tests fixed? → Full success
- Some tests remain unfixed? → Partial completion
- Tests passed on first run? → Success (no fixes needed)

---

## Display Summary

### If All Tests Fixed/Passed

Display:
```
✅ All tests fixed and passed!
```

### If Tests Remain Unfixed

Display:
```
⚠️ Workflow incomplete. Some tests remain unfixed.
```

---

## Summary Details

→ Show concise summary with:
- **Tests fixed:** Count of tests fixed in this session
- **Tests skipped/remaining:** Count of tests not addressed
- **Root causes addressed:** List of distinct issues resolved

Example format:
```
📊 Session Summary:
   - Tests fixed: 12
   - Tests skipped: 3
   - Root causes:
     - Incorrect import paths (5 tests)  
     - Missing mock setup (4 tests)
     - Type errors (3 tests)
```

---

## Cleanup

→ Clear todo list using TodoWrite with empty array

---

## Exit

→ Return control to user

→ Workflow complete
