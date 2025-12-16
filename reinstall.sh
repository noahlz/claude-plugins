#!/bin/bash

echo "Reloading..."

claude plugin uninstall dev-workflow@noahlz.github.io
claude plugin marketplace remove noahlz.github.io

claude plugin marketplace add ./
claude plugin install dev-workflow@noahlz.github.io

echo "Done, restart Claude Code."
