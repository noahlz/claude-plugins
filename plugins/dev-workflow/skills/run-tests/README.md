# Run Tests

Guides Claude through building and testing your project. When failures occur, provides root cause analysis and fix recommendations via specialized sub-agents.

## What It Does

- Infers the test command from project files (`package.json`, `pom.xml`, `go.mod`, `Cargo.toml`, `Makefile`, etc.) or memory
- Captures all test/build output to a file (never pollutes the console)
- Analyzes compilation errors using the `broken-build-analyzer` agent
- Analyzes test failures using the `failed-test-analyzer` agent
- Provides root cause analysis and fix recommendations suitable for subsequent Plan mode

## Prerequisites

- `node` version 22+

## Usage

Slash command:

```bash
/run-tests              # Run all tests
```

Or tell Claude: "run tests", "test", "build and test", "fix tests", etc.

## How It Infers the Test Command

The skill checks in order:
1. Claude memory (if you've run tests before in this project)
2. `CLAUDE.md` in the project root
3. Standard project files (`package.json`, `pom.xml`, `go.mod`, etc.)
4. Asks you via `AskUserQuestion` if still uncertain — then saves the answer to memory

## Agents

This skill delegates to specialized analyzer agents for root cause analysis:

- [broken-build-analyzer](../../agents/broken-build-analyzer.md) - Analyzes compilation failures
- [failed-test-analyzer](../../agents/failed-test-analyzer.md) - Analyzes test failures

Both agents provide fix recommendations without making edits. The user implements fixes via plan mode.

## Author

[@noahlz](https://github.com/noahlz)
[Claude](https://claude.com/product/claude-code)
