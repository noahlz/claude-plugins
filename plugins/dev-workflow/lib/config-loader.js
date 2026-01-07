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
 * Write JSON file with formatting
 * @param {string} filePath - Path to write to
 * @param {object} data - Data to write
 */
export function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
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

/**
 * Deep merge two objects (second overwrites first)
 * @param {object} defaultObj - Default config
 * @param {object} projectObj - Project config (overrides)
 * @returns {object} - Merged config
 */
function mergeConfigs(defaultObj, projectObj) {
  if (!defaultObj) return projectObj;
  if (!projectObj) return defaultObj;

  const result = JSON.parse(JSON.stringify(defaultObj));

  for (const key in projectObj) {
    if (projectObj[key] === null || projectObj[key] === undefined) {
      continue;
    }

    if (typeof projectObj[key] === 'object' && !Array.isArray(projectObj[key])) {
      result[key] = mergeConfigs(result[key] || {}, projectObj[key]);
    } else {
      result[key] = projectObj[key];
    }
  }

  return result;
}
