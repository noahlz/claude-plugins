import fs from 'fs';
import path from 'path';

/**
 * Parse JSON file with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {object|null} - Parsed JSON or null if file doesn't exist
 * @throws {Error} - If file exists but is invalid JSON
 */
export function parseJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

/**
 * Load skill config from .claude/settings.plugins.{skillName}.json
 * @param {string} skillName - Skill name
 * @param {string} baseDir - Base directory (defaults to current dir)
 * @returns {object|null} - Parsed config or null if not found
 */
export function loadSkillConfig(skillName, baseDir = '.') {
  const configPath = path.join(baseDir, `.claude/settings.plugins.${skillName}.json`);
  return parseJsonFile(configPath);
}