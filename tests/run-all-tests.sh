#!/bin/bash
# Master test runner for claude-plugins tests
# Runs all test files and reports summary

set -e

# Get test root directory
TESTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_SUITES=()

# Function to run a single test file
run_test_file() {
  local test_file="$1"
  local suite_name=$(basename "$test_file" .sh)

  echo -e "${YELLOW}Running: $suite_name${NC}"

  # Run the test file and capture output
  if output=$(bash "$test_file" 2>&1); then
    # Count tests from output (strip ANSI codes first)
    local suite_tests=$(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | grep "^Ran" | grep -oE '[0-9]+' | head -1)
    if [ -n "$suite_tests" ]; then
      TOTAL_TESTS=$((TOTAL_TESTS + suite_tests))
      PASSED_TESTS=$((PASSED_TESTS + suite_tests))
      echo -e "${GREEN}✓ $suite_name passed (${suite_tests} tests)${NC}"
    fi
  else
    # Test failed
    echo -e "${RED}✗ $suite_name failed${NC}"
    FAILED_SUITES+=("$suite_name")

    # Try to extract number of tests and failures (strip ANSI codes first)
    local suite_tests=$(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | grep "^Ran" | grep -oE '[0-9]+' | head -1)
    local failures=$(echo "$output" | grep "FAILED" | grep -oE 'failures=[0-9]+' | grep -oE '[0-9]+')

    if [ -n "$suite_tests" ]; then
      TOTAL_TESTS=$((TOTAL_TESTS + suite_tests))
      FAILED_TESTS=$((FAILED_TESTS + ${failures:-$suite_tests}))
    fi
  fi
}

# Find and run all test files
echo "Starting test suite..."
echo ""

test_files=()
for dir in "$TESTS_ROOT"/write-git-commit "$TESTS_ROOT"/run-and-fix-tests; do
  if [ -d "$dir" ]; then
    while IFS= read -r -d '' file; do
      test_files+=("$file")
    done < <(find "$dir" -maxdepth 1 -name 'test-*.sh' -type f -print0 | sort -z)
  fi
done

# Run each test file
for test_file in "${test_files[@]}"; do
  run_test_file "$test_file"
done

# Print summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="

if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  echo "Total tests run: $TOTAL_TESTS"
  exit 0
else
  echo -e "${RED}Some tests failed${NC}"
  echo "Total tests run: $TOTAL_TESTS"
  echo "Passed: $PASSED_TESTS"
  echo "Failed: $FAILED_TESTS"
  echo ""
  echo "Failed suites:"
  for suite in "${FAILED_SUITES[@]}"; do
    echo "  - $suite"
  done
  exit 1
fi
