# Run and Fix Tests Plugin

Build project and run tests with clean output. Optionally fix any failures.

## Features

- Silent build/test execution (output redirected to logs only)
- Run all tests or single test: `/test` or `/test MyTest`
- Automatic error extraction and display (first N errors)
- Ask user before fixing: "Do you want me to fix these errors?"
- Fix tests one by one with progress tracking (TodoWrite)
- Configurable build and test commands per project
- Deep merge of default + project-specific configs
- Supports npm, yarn, and other build tools

## Usage

Trigger the skill:
- `/test` - Run all tests and fix any failures
- `/test MyTest` - Run a single test and fix failures
- Or say "run tests", "test", "build and test", "fix tests", or "make test"

### Prerequisites

- bash shell (for config loading)
- jq (JSON query tool)
- grep (for pattern matching)
- Project has `npm run build` and `npm test` (or configured alternatives)

### Workflow

1. Loads configuration (default + project override if present)
2. Builds project silently, displays errors if build fails
   - **Asks user**: "Build failed. Should I analyze and fix the build issues?"
3. Runs tests silently (all tests or single test), displays errors if tests fail
4. Analyzes failures and creates todo list of failing tests
5. **Asks user**: "Start fixing tests one by one?"
   - **Yes** → Proceeds to fix tests iteratively
   - **No, I'll fix manually** → Stops
   - **Other** → Follow custom instruction
6. For each failing test:
   - Marks test as in_progress
   - Fixes the test
   - Marks test as completed
   - **Asks user**: "Test fixed! What next?" with options:
     - **Fix next test** → Fix next failing test
     - **Re-run all tests** → Clear todos and re-run all tests
     - **Stop for now** → Stop (preserves todo list)
     - **Other** → Custom instruction
7. Repeats until all tests pass

### Configuration

#### Default

Default config in `build-config.json` supports npm + vite + jest:

```json
{
  "logDir": "dist",
  "build": {
    "command": "npm run build",
    "logFile": "{logDir}/build.log",
    "errorPattern": "(error|Error|✘)"
  },
  "test": {
    "all": {
      "command": "npm test",
      "logFile": "{logDir}/test.log",
      "errorPattern": "(FAIL|●|Error:|Expected|Received)"
    },
    "single": {
      "command": "npm test -- {testFile}",
      "logFile": "{logDir}/test-single.log",
      "errorPattern": "(FAIL|●|Error:|Expected|Received)"
    }
  }
}
```

#### Project Override

Create `.claude/build-config.json` in your project to customize:

```json
{
  "logDir": "build-output",
  "build": {
    "command": "yarn build"
  },
  "test": {
    "all": {
      "command": "yarn test:ci"
    },
    "single": {
      "command": "yarn test -- {testFile}"
    }
  }
}
```

Project config deep-merges with defaults (project values override).

### Single Test Execution

Use the command argument to run a single test:

```bash
/test MyTest
/test src/components/Button.test.ts
/test button.*
```

The argument replaces `{testFile}` in the single test command configuration. Useful for:
- Debugging a specific failing test
- Quick iteration on one test during development
- Running tests matching a pattern

## Author

[@noahlz](https://github.com/noahlz)