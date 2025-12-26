---
name: test
description: Run the project test suite (or a single test) and systematically fix any failures.
argument-hint: "[testName]"
---

Use the `run-and-fix-tests` skill to build, run tests, and fix failures. The skill delegates to the `test-fixer` agent for complex fix analysis. If a specific test name is provided in the argument ($1), run only that test. Otherwise, run all tests. Automatically fix any test failures if the user approves.
