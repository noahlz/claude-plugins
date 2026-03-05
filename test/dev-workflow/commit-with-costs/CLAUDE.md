# Testing Methodology: commit-with-costs

Tips on writing and running tests for the commit-with-costs script suite.

## Test Environment Lifecycle

### Git Integration Tests

Use `setupGitRepo(testEnv)` to create real git repository with proper user configuration.

**Example:** See [`git-operations.integration.test.js`](./git-operations.integration.test.js)

## Troubleshooting

### Git Command Failures

Ensure `setupGitRepo(testEnv)` is called in `beforeEach()` to configure user.email and user.name.
