# Run and Fix Tests Plugin

Guides Claude through automatically building, running and fixing your project tests with minimal token usage. 

## What It Does

- Builds and tests your project using the appropriate build tool
- Fixes failing tests one by one (with your approval)
- Supports single test execution: `/test MyTest`
- Supports multi-module projects with different build tools (custom configuration required)

## Prerequisites

- `bash` (i.e. MiniGW if on Windows)
- `jq`

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
2. **Selects** the appropriate default configuration from the `defaults/` directory
3. **Creates** `.claude/settings.plugins.run-and-fix-tests.json` in your project

See [settings.plugins.run-and-fix-tests.json](./settings.plugins.run-and-fix-tests.json) for out-of-the-box supported tools and files under [defaults/](./defaults) for default configurations. You can also customize your projects tool detection in your project or user-level plugin configuration. The configurations are merged.

Note: The default `polyglot.json` serves as an example multi-module build (see next section).

### Multi-Tool Projects

If your project has multiple build tools detected (e.g., npm + maven), the plugin automatically generates a polyglot configuration that builds all tools in sequence:

```
🔧 Multiple build tools detected, creating polyglot configuration...
```

The generated config uses an array structure for `build` to run each tool in order.

### Placeholder Configuration

If your build tool isn't recognized, the plugin creates a placeholder template.  You must edit the config before using the plugin. Replace the placeholders with your actual commands.

See the [`defaults/example.json`](./defaults/example.json) file for the placeholder template structure.

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

## Author

[@noahlz](https://github.com/noahlz)
