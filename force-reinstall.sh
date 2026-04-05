#!/bin/bash

# Force a full uninstall + reinstall of all plugins in marketplace.json.
#
# WHY THIS EXISTS:
# Claude Code caches plugins by version number. When you modify plugin files
# without bumping the version, /reload-plugins reloads from stale cache and
# does NOT pick up source changes.
#
# This script bypasses version caching by removing each plugin's cache dir
# before reinstalling, ensuring your latest source changes are picked up.
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

MARKETPLACE=".claude-plugin/marketplace.json"

# Read all plugin names and versions from marketplace.json
PLUGIN_NAMES=($(jq -r '.plugins[].name' "$MARKETPLACE"))
PLUGIN_VERSIONS=($(jq -r '.plugins[].version' "$MARKETPLACE"))

echo "Forcing reinstallation of all plugins: ${PLUGIN_NAMES[*]}"
echo ""

# Uninstall all plugins before removing the marketplace
for name in "${PLUGIN_NAMES[@]}"; do
  claude plugin uninstall "${name}@noahlz.github.io" 2>/dev/null || echo "(${name} was not installed — skipping uninstall)"
done

claude plugin marketplace remove noahlz.github.io 2>/dev/null || echo "(marketplace was not registered — skipping remove)"

# Delete each plugin's cache dir to bypass version caching.
# Without this, Claude Code skips reinstall when the version number hasn't changed.
for i in "${!PLUGIN_NAMES[@]}"; do
  name="${PLUGIN_NAMES[$i]}"
  version="${PLUGIN_VERSIONS[$i]}"
  cache_path="$HOME/.claude/plugins/cache/noahlz-github-io/${name}/${version}"
  echo "Removing cache: $cache_path"
  rm -rf "$cache_path"
done
echo ""

# Reinstall all plugins from local source
claude plugin marketplace add ./
for name in "${PLUGIN_NAMES[@]}"; do
  claude plugin install "${name}@noahlz.github.io"
done
