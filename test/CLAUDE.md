# Testing Methodology

- `node:test` + `node:assert` only — no external test/mock libraries
- Target: all tests complete in < 5 seconds
- Unit tests (`*.unit.test.js`): mock all deps. Integration tests (`*.integration.test.js`): real git repos, subprocesses.
- Follow existing patterns in any test file. Reuse helpers from `./dev-workflow/*/helpers.js`.

## Gotcha: Hanging Tests

Functions with stdin fallback block when empty string triggers the fallback (`''` is falsy).
Fix: use `if (msg !== null && msg !== undefined)` instead of `if (msg)`.
