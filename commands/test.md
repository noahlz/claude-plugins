---
name: test
description: Activate the `test-runner-fixer` agent to use the `run-and-fix-tests` skill to build the project, run tests, and fix failures. Use /test for all tests or /test <testName> for a single test.
argument-hint: "[testName]"
---

Activate the `test-runner-fixer` agent to use the `run-and-fix-tests` skill to build the project, run tests and systematically fix failures one by one. If a specific test name is provided in the argument ($1), run only that test. Otherwise, run all tests. Automatically fix any test failures if the user approves.