# Testing Methodology: run-and-fix-tests

Tips on writing and running tests for the run-and-fix-tests script suite:

## Test Helpers

Use helpers from [`./helpers.js`](./helpers.js):
- `createMockFs(content)` — mock fs for parser unit tests
- `createMockGlobDeps(files)` — mock deps for glob mode tests
- `parseBuildWithMock(pattern, logContent)` — run parseBuildErrors with mock fs
- `parseTestsWithMock(pattern, resultsContent)` — run parseTestFailures with mock fs
- `parseTestsWithGlob(filePath, pattern, files)` — run parseTestFailures in glob mode
- `assertParserResult`, `assertErrorDetails`, `assertFailureDetails`, `assertGlobResult` — assertion helpers

## Test Files

- `run-command.test.js` — integration tests for the command runner script
- `parse-test-failures.test.js` — unit tests for the test failure parser
- `parse-build-errors.test.js` — unit tests for the build error parser
