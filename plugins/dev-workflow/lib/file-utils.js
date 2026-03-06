import fs from 'fs';

/**
 * Read a file, throwing a descriptive error on failure
 * @param {string} filePath - File path to read
 * @param {object} options - Options
 * @param {string} options.label - Human-readable label for error messages (e.g. "log file")
 * @param {object} options.fs - fs module (for dependency injection in tests)
 * @returns {string} - File contents
 */
export function readFileSafe(filePath, { label = 'file', fs: fsModule = fs } = {}) {
  try {
    return fsModule.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${err.message}`);
  }
}

/**
 * Compile a regex pattern, throwing a descriptive error if invalid
 * @param {string} pattern - Regex pattern string
 * @param {string} flags - Regex flags (default: 'gm')
 * @returns {RegExp} - Compiled regex
 */
export function compilePattern(pattern, flags = 'gm') {
  try {
    return new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`Invalid regex pattern "${pattern}": ${err.message}`);
  }
}
