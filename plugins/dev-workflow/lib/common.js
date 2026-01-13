/**
 * Resolve path variables like {outDir}
 * @param {string} pathStr - Path string with variables
 * @param {object} context - Context object with variables
 * @returns {string} - Resolved path
 */
export function resolvePath(pathStr, context = {}) {
  if (!pathStr) return pathStr;

  // Default variables
  const vars = {
    logDir: context.logDir,
    ...context
  };

  // Replace {varName} with value
  return pathStr.replace(/{(\w+)}/g, (match, name) => {
    return vars[name] !== undefined ? vars[name] : match;
  });
}

