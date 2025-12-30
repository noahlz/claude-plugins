#!/bin/bash
set -e

PLUGIN_SRC=${1:-noahlz/claude-plugins}

echo "Installing dev-workflow plugin..."
echo ""
echo "Checking plugin dependencies..."

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "*** Error: Node.js is required but not installed."
  echo "*** Please install Node.js 18+ (https://nodejs.org/)"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "*** Error: Node.js 18 or higher required (found: $(node -v))"
  echo "*** Please upgrade to use this plugin."
  exit 1
fi

echo "✓ Node.js $NODE_VERSION detected"

# Check npm
if ! command -v npm &> /dev/null; then
  echo "*** Error: npm is required but not installed."
  echo "*** Please install: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm"
  exit 1
fi

echo "✓ npm $(npm -v) detected"
echo ""

# Add marketplace
echo "Adding plugin marketplace..."
claude plugin marketplace add $PLUGIN_SRC

# Install plugin
echo "Installing dev-workflow plugin..."
claude plugin install dev-workflow@noahlz.github.io

echo ""
echo "Installing plugin dependencies..."

# Try to find and install in the plugin directory
# First, try the standard cache location with 'latest' version

PLUGIN_BASE=".claude/plugins/cache/noahlz-github-io/dev-workflow"
PLUGIN_VERSION=$(ls -lht -1 $HOME/$PLUGIN_BASE)
PLUGIN_DIR=$HOME/$PLUGIN_BASE/$PLUGIN_VERSION

if [ ! -d "$PLUGIN_DIR" ]; then
    echo "*** FAILED to resolve plugin version directory under cache?! Path not found: $PLUGIN_DIR"
fi

if [ -d "$PLUGIN_DIR" ]; then
  echo "Found plugin at: $PLUGIN_DIR"
  echo "Running npm install..."
  (pushd "$PLUGIN_DIR" > /dev/null && npm install && popd > /dev/null)
  echo "✓ Plugin dependencies installed"
else
  echo "*** Could not locate plugin directory automatically."
  echo "*** Please manually run: npm install"
  echo "*** in your Claude Code plugin directory for dev-workflow"
  exit 1
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "Restart Claude Code to use the plugin."
