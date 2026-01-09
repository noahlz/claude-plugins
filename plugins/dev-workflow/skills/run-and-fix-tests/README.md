# Run and Fix Tests

Guides Claude through automatically building, running and fixing your project tests with minimal token usage. 

## What It Does

- Builds and tests your project using the appropriate build tool
- Fixes compilation errors one by one using the `build-fixer` agent (with your approval)
- Fixes failing tests one by one using the `test-fixer` agent (with your approval)
- Supports single test execution: `/test MyTest`
- Supports multi-module projects with different build tools (custom configuration required)

## Quick Start

```bash
/test
```

The skill auto-detects your build tool and runs your tests. If tests fail, it offers to fix them one-by-one with your approval.

## When to Use

- After making code changes to verify they work
- To systematically fix compilation errors or test failures
- When CI/CD tests are failing and you need to debug locally

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

To reset and re-detect your build tools, delete `.claude/settings.plugins.run-and-fix-tests.json` and run `/test` again.

## Agents

**build-fixer**: Fixes compilation errors one-by-one with IDE diagnostics and LSP support. Rebuilds after each fix to catch cascading effects.

**test-fixer**: Fixes failing tests one-by-one by running individual tests to verify each fix.

Both agents offer approval prompts after each fix (continue/skip/stop) to maintain your control.

## Author

[@noahlz](https://github.com/noahlz)
