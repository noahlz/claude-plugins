# Silent Build & Test Output

## Philosophy

Build and test commands should produce **zero output** to the console on success. All logging should go to dedicated log files in output directories (which are `.gitignore`d). This approach:

- ✓ Keeps the console clean and readable
- ✓ Only shows errors when they occur (non-zero exit code)
- ✓ Maintains build artifacts for debugging without cluttering commits
- ✓ Enables fast visual feedback on build/test status

---

## Implementation Pattern

### Redirect Output to Log Files

All build and test commands should redirect stdout and stderr to log files:

```json
{
  "scripts": {
    "build:unit": "your-build-tool > .logs/build.log 2>&1",
    "test:unit": "your-test-tool --silent > .logs/test-unit.log 2>&1",
    "test:integration": "your-test-tool --silent > .logs/test-integration.log 2>&1"
  }
}
```

Key patterns:
- `> .logs/filename.log` - Redirect stdout to log file
- `2>&1` - Also capture stderr to the same file
- `--silent` flag (if supported by your tool) - Suppress verbose output

---

## Error Handling Strategy

### On Non-Zero Exit Code

When a command fails, **extract only the specific error** from the log file using tool-specific patterns. **Never dump the full log to console.**

```bash
#!/bin/bash
# Example error handling in a CI/CD pipeline

npm run build:vite
if [ $? -ne 0 ]; then
    echo "❌ Vite build failed:"
    # Extract Vite errors (lines containing "error" or "Error")
    grep -i "error" .logs/build-vite.log | head -20
    echo ""
    echo "Full log: .logs/build-vite.log"
    exit 1
fi

npm run build:electron
if [ $? -ne 0 ]; then
    echo "❌ Electron build failed:"
    # Extract electron-builder errors
    grep -E "(error|Error|ERROR|✖)" .logs/build-electron.log | head -20
    echo ""
    echo "Full log: .logs/build-electron.log"
    exit 1
fi

npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed:"
    # Extract Jest failures (FAIL lines and summary)
    grep -E "(FAIL|●|Error:|Expected|Received)" .logs/test-unit.log | head -30
    echo ""
    echo "Full log: .logs/test-unit.log"
    exit 1
fi

echo "✅ All checks passed"
```

### Tool-Specific Error Patterns

| Tool | Error Pattern | Grep Command |
|------|---------------|--------------|
| **Vite** | Lines with "error", "Error", "✘" | `grep -iE "(error\|✘)" .logs/build-vite.log` |
| **electron-builder** | Lines with "error", "Error", "✖", "⨯" | `grep -E "(error\|Error\|ERROR\|✖\|⨯)" .logs/build-electron.log` |
| **Jest** | FAIL, ●, Error:, Expected/Received | `grep -E "(FAIL\|●\|Error:\|Expected\|Received)" .logs/test-unit.log` |
| **ESLint** | Lines with "error", "warning" | `grep -E "error\|warning" .logs/lint.log` |
| **TypeScript** | Lines with "error TS" | `grep "error TS" .logs/tsc.log` |

### In Claude Code Integration

When using Claude Code helpers or CI/CD:

1. Run build/test command
2. Check `$?` (exit code)
3. If non-zero:
   - Use tool-specific grep pattern to extract errors
   - Show first 20-30 lines of errors only
   - Display path to full log file
4. If zero: Report success with single-line status

---

## Tool-Specific Configuration

Most tools have a "silent" or "quiet" mode flag. Check your tool's documentation for:
- `--silent` - Many build/test tools support this
- `--quiet` or `-q` - Alternative quiet flags
- Config file options to suppress verbose output (e.g., `verbose: false` in Jest, `reportCompressedSize: false` in Vite)

---

## Error Extraction Helper Script

Create a reusable script to extract errors from log files:

**File: `scripts/extract-errors.sh`**:

```bash
#!/bin/bash
# Extract and display errors from build/test logs
# Usage: ./scripts/extract-errors.sh <log-file> <error-pattern>

LOG_FILE=$1
ERROR_PATTERN=$2

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file not found: $LOG_FILE"
  exit 1
fi

echo "❌ Command failed:"
grep -E "$ERROR_PATTERN" "$LOG_FILE" | head -20
echo ""
echo "Full log: $LOG_FILE"
exit 1
```

**Make executable:**
```bash
chmod +x scripts/extract-errors.sh
```

**Usage in npm scripts:**
```bash
npm run build || ./scripts/extract-errors.sh .logs/build.log "error|Error|ERROR"
npm run test || ./scripts/extract-errors.sh .logs/test.log "FAIL|●|Error:"
```

