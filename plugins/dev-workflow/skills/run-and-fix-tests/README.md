# Run and Fix Tests Plugin

Guides Claude through automatically building, running and fixing your project tests with minmimal token usage. 

## What It Does

- Builds your project using the appropriate build tool
- Runs tests and displays failures
- Fixes failing tests one by one (with your approval)
- Supports single test execution: `/test MyTest`
- Supports multi-module projects with different build tools

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

**Detected build tools:**
- `package.json` → npm (with vite)
- `pom.xml` → Maven
- `build.gradle` → Gradle
- `go.mod` → Go
- `build.sbt` → SBT
- `Cargo.toml` → Rust (cargo)
- `*.csproj` → .NET (dotnet)
- `project.clj` → Leiningen
- `deps.edn` → Clojure CLI
- `Makefile` → Make

### Available Default Configurations

The plugin includes pre-built default configurations for each tool:

- `npm.json` - Node.js/Vite projects
- `maven.json` - Maven with native logging
- `gradle.json` - Gradle (single or multi-module)
- `go.json` - Go projects
- `sbt.json` - Scala/SBT
- `cargo.json` - Rust (release build)
- `rust.json` - Rust (debug build)
- `dotnet.json` - .NET projects
- `make.json` - Makefile-based
- `leiningen.json`, `clojure.json` - Clojure
- `polyglot.json` - Multi-tool projects

### Multi-Tool Projects

If your project has multiple build tools detected (e.g., npm + maven), the plugin automatically generates a polyglot configuration that builds all tools in sequence:

```
🔧 Multiple build tools detected, creating polyglot configuration...
```

The generated config uses an array structure for `build` to run each tool in order.

### Placeholder Configuration

If your build tool isn't recognized, the plugin creates a placeholder template:

```
🚨 PLACEHOLDER CONFIG CREATED - YOU MUST CUSTOMIZE IT
   Edit: .claude/settings.plugins.run-and-fix-tests.json
   Replace all __PLACEHOLDER_*__ values with your build/test commands
```

You must edit the config before using the plugin. Replace the placeholders with your actual commands.

If you try to run the plugin with uncustomized placeholders, you'll see:

```
🚨🚨🚨 CONFIGURATION REQUIRED 🚨🚨🚨

Your config contains placeholder values that must be replaced.
```

See the `defaults/example.json` file for the placeholder template structure.

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
