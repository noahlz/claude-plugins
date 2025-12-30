#!/bin/bash

echo "Reloading..."

# Uninstall plugin and marketplace
claude plugin uninstall dev-workflow@noahlz.github.io
claude plugin marketplace remove noahlz.github.io

# Read version from marketplace.json and delete cache
VERSION=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)
CACHE_PATH="$HOME/.claude/plugins/cache/noahlz-github-io/dev-workflow/$VERSION"

echo "Removing cached plugin at: $CACHE_PATH"
rm -rf "$CACHE_PATH"
echo ""

# Reinstall
./plugins/dev-workflow/install.sh $PWD
