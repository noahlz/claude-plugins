---
name: test
description: Build project, run tests, and optionally fix failures. Use /test for all tests or /test <testName> for a single test.
argument-hint: "[testName]"
---

Use the run-and-fix-tests skill to build the project and run tests. If a specific test name is provided in the argument ($1), run only that test. Otherwise, run all tests. Automatically fix any test failures if the user approves.