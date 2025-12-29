import fs from 'fs';
import path from 'path';

/**
 * Recursively find files matching a glob-like pattern
 * Supports simple glob patterns like "*.json", "*.csproj"
 * Does not support complex globs like **\/ or {}
 * @param {string} pattern - File pattern (e.g., "*.json", "Makefile")
 * @param {string} searchDir - Directory to search in
 * @param {number} maxDepth - Maximum directory depth (default 3)
 * @returns {array} - Array of matching file paths
 */
export function findFiles(pattern, searchDir = '.', maxDepth = 3) {
  const matches = [];

  function search(dir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        // Skip hidden directories except .claude
        if (entry.startsWith('.') && entry !== '.claude') continue;

        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          search(fullPath, depth + 1);
        } else if (stat.isFile() && matchesPattern(entry, pattern)) {
          matches.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  search(searchDir, 0);
  return matches;
}

/**
 * Check if filename matches simple glob pattern
 * Supports: *.ext, exact match, Makefile style names
 * @param {string} filename - Filename to check
 * @param {string} pattern - Pattern (e.g., "*.json", "Makefile")
 * @returns {boolean}
 */
export function matchesPattern(filename, pattern) {
  if (pattern.startsWith('*.')) {
    // Extension pattern
    const ext = pattern.substring(1); // e.g., ".json"
    return filename.endsWith(ext);
  } else {
    // Exact match
    return filename === pattern;
  }
}

/**
 * Copy file, creating parent directories if needed
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 */
export function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {boolean}
 */
export function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if directory exists
 * @param {string} dirPath - Directory path
 * @returns {boolean}
 */
export function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get directory name from file path, normalized
 * Returns "(project root)" for "." paths or when file is in rootDir
 * @param {string} filePath - File path
 * @param {string} rootDir - Root directory to compare against (defaults to '.')
 * @returns {string}
 */
export function getNormalizedDir(filePath, rootDir = '.') {
  const dir = path.dirname(filePath);
  const resolvedDir = path.resolve(dir);
  const resolvedRoot = path.resolve(rootDir);

  if (dir === '.' || dir === '' || resolvedDir === resolvedRoot) {
    return '(project root)';
  }
  return dir;
}

/**
 * Create .claude directory if it doesn't exist
 * @param {string} baseDir - Base directory (defaults to current dir)
 * @returns {string} - Path to .claude directory
 */
export function ensureClaudeDir(baseDir = '.') {
  const claudeDir = path.join(baseDir, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  return claudeDir;
}
