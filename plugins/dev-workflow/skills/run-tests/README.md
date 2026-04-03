# Run Tests

Guides Claude through building and testing your project. When failures occur, provides root cause analysis and fix recommendations via specialized sub-agents.

## What It Does

Infers the test command from project files or memory, captures all output to a log file, and delegates compilation errors to `broken-build-analyzer` or test failures to `failed-test-analyzer` for root cause analysis and fix recommendations.

## Prerequisites

- `node` version 22+

## Usage

```bash
/run-tests
```

Or tell Claude: "run tests", "test", "build and test", "fix tests", etc.

## How It Infers the Test Command

Checks Claude memory, then `CLAUDE.md`, then standard project files (`package.json`, `pom.xml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.), then asks via `AskUserQuestion` if still uncertain and saves the answer to memory.

## Edge Cases

- **No recognized project file** — prompts for the test command and saves to memory
- **Build failure** — routes to `broken-build-analyzer` before running tests
- **Test failure** — routes to `failed-test-analyzer` for per-failure diagnosis