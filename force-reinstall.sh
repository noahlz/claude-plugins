#!/bin/bash

# Force a full uninstall + reinstall of the dev-workflow plugin.
#
# WHY THIS EXISTS:
# Claude Code caches plugins by version number. During development, when you
# modify plugin files without bumping the version in marketplace.json, Claude
# Code's /reload-plugins command reloads from the stale cache and does NOT
# pick up your source changes.
#
# This script bypasses the version cache by explicitly removing the cached
# plugin directory before reinstalling, ensuring your latest source changes
# are always picked up.
#
# USE WHEN:
#   - You've modified SKILL.md, scripts, agents, or other plugin files
#   - /reload-plugins is not reflecting your changes
#   - You want a guaranteed clean install without bumping the version
#
# NORMAL DEVELOPMENT FLOW:
#   1. Edit plugin source files
#   2. Run this script
#   3. Restart Claude Code (or use /reload-plugins after reinstall)

set -e

echo "Forcing reinstallation of dev-workflow plugin..."
echo ""

# Uninstall plugin and marketplace
claude plugin uninstall dev-workflow@noahlz.github.io
claude plugin marketplace remove noahlz.github.io

# Delete the cached plugin directory to bypass version caching.
# Without this, Claude Code would skip reinstall if the version number
# in marketplace.json hasn't changed.
VERSION=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)
CACHE_PATH="$HOME/.claude/plugins/cache/noahlz-github-io/dev-workflow/$VERSION"

echo "Removing cached plugin at: $CACHE_PATH"
rm -rf "$CACHE_PATH"
echo ""

# Reinstall from local source
claude plugin marketplace add ./
claude plugin install dev-workflow@noahlz.github.io
