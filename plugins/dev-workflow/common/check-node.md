Verify that Node.js is installed and available:
```bash
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required but not installed. Please install Node.js 22 or later." >&2; exit 1; }
NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION found"
```

✓ Node.js available → Proceed to step 1 (Detect Build Configuration)  
✗ Node.js not found → Error: Exit with message asking user to install Node.js  

