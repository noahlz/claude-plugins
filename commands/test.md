---
name: test
description: Run the project test suite (or a single test) and systematically fix any failures.
argument-hint: "[testName]"
---

Activate the `test-runner-fixer` agent to use the `run-and-fix-tests` skill to build the project, run tests and systematically fix failures one-by-one. If a specific test name is provided in the argument ($1), run only that test. Otherwise, run all tests. Automatically fix any test failures if the user approves.
