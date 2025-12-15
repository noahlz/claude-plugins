# Run and Fix Tests Plugin

Build project and run tests with clean output. Optionally fix any failures.

## Features

- Silent build/test execution (output redirected to logs only)
- Automatic error extraction and display (first N errors)
- Ask user before fixing: "Do you want me to fix these errors?"
- Configurable build and test commands per project
- Deep merge of default + project-specific configs
- Supports npm, yarn, and other build tools

## Usage

Trigger the skill: `/test` or say "run tests", "test", "build and test", "fix tests", or "make test".

### Prerequisites

- Project has `npm run build` and `npm test` (or configured alternatives)
- Node.js available (for config loading)

### Workflow

1. Loads configuration (default + project override if present)
2. Builds project silently, displays errors if build fails
3. Runs all tests silently, displays errors if tests fail
4. **Asks user**: "Do you want me to fix these errors?"
   - **Yes** → Analyzes failures and fixes code, re-runs tests iteratively
   - **No, I'll fix manually** → Stops, user fixes code
   - **Other** → User provides custom instruction
5. Repeats until all tests pass

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
    }
  }
}
```

Project config deep-merges with defaults (project values override).

## Author

[@noahlz](https://github.com/noahlz)