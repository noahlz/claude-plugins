# Run and Fix Tests

Guides Claude through building and testing your project with minimal token usage. When failures occur, provides root cause analysis and fix recommendations.

## What It Does

- Builds and tests your project with minimal console output, per configuration file: `.claude/settings.plugins.run-and-fix-tests.json`
- Analyzes compilation errors using the `broken-build-analyzer` agent
- Analyzes test failures using the `failed-test-analyzer` agent
- Provides root cause analysis and fix recommendations suitable for subsequent Plan mode
- Supports single test execution: `/test MyTest`
- Supports multi-module projects with different build tools (custom configuration required)

## Prerequisites

- `node` version 22+

## Usage

```bash
/test              # Run all tests
/test MyTest       # Run a single test
```

Or say: "run tests", "test", "build and test", "fix tests", "make test"

## Configuration

### Auto-Configuration

When you run `/test` for the first time, the plugin automatically:

1. **Detects** your project's build tools by scanning for standard config files
2. **Selects** the appropriate default configuration from the `assets/defaults/` directory
3. **Creates** `.claude/settings.plugins.run-and-fix-tests.json` in your project

See [settings.plugins.run-and-fix-tests.json](./assets/defaults/settings.plugins.run-and-fix-tests.json) (reference file showing all supported build tools) and [assets/defaults/](./assets/defaults) for example default configurations. You can customize tool detection in your project or user-level plugin configuration. Configurations are merged with defaults.

Note: The default `polyglot.json` serves as an example multi-module build (see next section).

### Multi-Tool Projects

If your project has multiple build tools detected (e.g., npm + maven), the plugin automatically generates a polyglot configuration that builds all tools in sequence:

```
🔧 Multiple build tools detected, creating polyglot configuration...
```

The generated config uses an array structure for `build` to run each tool in order.

### Placeholder Configuration

If your build tool isn't recognized, the plugin creates a placeholder template.  You must edit the config before using the plugin. Replace the placeholders with your actual commands.

See the [`assets/defaults/TEMPLATE.json`](./assets/defaults/TEMPLATE.json) file for the placeholder template structure.

### Customizing Configuration

To customize after auto-config, edit `.claude/settings.plugins.run-and-fix-tests.json`:

```json
{
  "logDir": "dist",
  "build": {
    "command": "yarn build"
  },
  "test": {
    "all": {
      "command": "yarn test:ci"
    },
    "single": {
      "command": "yarn test {testFile}"
    }
  }
}
```

For multi-module projects, use an array for `build`:

```json
{
  "logDir": "build-logs",
  "build": [
    {
      "tool": "npm",
      "command": "npm run build",
      "workingDir": "frontend"
    },
    {
      "tool": "maven",
      "command": "mvn clean install",
      "workingDir": "backend"
    }
  ],
  "test": {
    "all": {
      "command": "npm test"
    },
    "single": {
      "command": "npm test -- {testFile}"
    }
  }
}
```

### Starting Over

To reset and re-detect your build tools, delete your project's `.claude/settings.plugins.run-and-fix-tests.json` and run `/test` again.

## Agents

This skill delegates to specialized analyzer agents for root cause analysis:

- [broken-build-analyzer](../../agents/broken-build-analyzer.md) - Analyzes compilation failures
- [failed-test-analyzer](../../agents/failed-test-analyzer.md) - Analyzes test failures

Both agents provide fix recommendations without making edits. The user implements fixes via plan mode.

## Author

[@noahlz](https://github.com/noahlz)
