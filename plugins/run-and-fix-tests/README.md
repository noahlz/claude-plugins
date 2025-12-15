# Run and Fix Tests Plugin

Build project and run tests with clean output. Automatically fix any failures.

## Features

- Silent build and test execution (logs only, no console spam)
- Automatic error extraction and display
- Configurable build and test commands
- Support for custom project configurations

## Configuration

### Default Configuration

Default configuration in `build-config.json` supports npm + vite + jest projects:

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
    }
  }
}
```

### Project Override

Create `.claude/build-config.json` in your project to override defaults:

```json
{
  "logDir": "build-logs",
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

## Author

Noah Zucker
