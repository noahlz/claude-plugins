#!/bin/bash
set -e

echo "Installing dev-workflow plugin..."
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not installed."
  echo "Please install Node.js 18+ from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js 18 or higher required (found: $(node -v))"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
  echo "Error: npm is required but not installed."
  echo "Please reinstall Node.js from https://nodejs.org/"
  exit 1
fi

echo "✓ npm $(npm -v) detected"
echo ""

# Add marketplace
echo "Adding plugin marketplace..."
claude plugin marketplace add https://github.com/noahlz/claude-plugins

# Install plugin
echo "Installing dev-workflow plugin..."
claude plugin install dev-workflow@noahlz.github.io

echo ""
echo "Installing plugin dependencies..."

# Try to find and install in the plugin directory
# First, try the standard cache location with 'latest' version
PLUGIN_DIR="$HOME/.claude/plugins/cache/noahlz-github-io/dev-workflow/latest"

if [ ! -d "$PLUGIN_DIR" ]; then
  # Try to find any version directory
  PLUGIN_BASE="$HOME/.claude/plugins/cache/noahlz-github-io/dev-workflow"
  if [ -d "$PLUGIN_BASE" ]; then
    # Get the first (likely only) version directory
    PLUGIN_DIR=$(ls -td "$PLUGIN_BASE"/*/ 2>/dev/null | head -1)
  fi
fi

if [ -d "$PLUGIN_DIR" ]; then
  echo "Found plugin at: $PLUGIN_DIR"
  (cd "$PLUGIN_DIR" && npm install)
  echo "✓ Plugin dependencies installed"
else
  echo "Warning: Could not locate plugin directory automatically."
  echo "Please manually run: npm install"
  echo "in your Claude Code plugin directory for dev-workflow"
  exit 1
fi

echo ""
echo "✓ Installation complete!"
echo "Please restart Claude Code to use the plugin."
