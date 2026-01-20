# Testing Methodology: write-git-commit

Tips on writing and running tests for the write-git-commit script suite:

## Test Environment Lifecycle

### Git Integration Tests

Use `setupGitRepo(testEnv)` to create real git repository with proper user configuration.

**Example:** See [`git-operations.integration.test.js`](./git-operations.integration.test.js)

## Troubleshooting

### Git Command Failures

Ensure `setupGitRepo(testEnv)` is called in `beforeEach()` to configure user.email and user.name.