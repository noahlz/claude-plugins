# Run and Fix Tests Plugin

Build your project and run tests. If tests fail, optionally fix them automatically.

## What It Does

- Builds your project using the appropriate build tool
- Runs tests and displays failures
- Fixes failing tests one by one (with your approval)
- Supports single test execution: `/test MyTest`
- Supports multi-module projects with different build tools

## Usage

```bash
/test              # Run all tests
/test MyTest       # Run a single test
/test pattern.*    # Run tests matching a pattern
```

Or say: "run tests", "test", "build and test", "fix tests", "make test"

## Configuration

The plugin auto-detects your build tool on first run by looking for standard config files:
- `package.json` → npm
- `pom.xml` → Maven
- `build.gradle` → Gradle
- `go.mod` → Go
- `build.sbt` → SBT
- `Cargo.toml` → Rust
- `*.csproj` → .NET
- `project.clj` → Leiningen
- `deps.edn` → Clojure CLI
- `Makefile` → Make

To customize build or test commands, create `.claude/build-config.json`:

```json
{
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
    }
  }
}
```

## Prerequisites

- bash shell
- jq
- grep

## Author

[@noahlz](https://github.com/noahlz)
