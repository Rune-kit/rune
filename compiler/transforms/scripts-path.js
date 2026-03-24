/**
 * Scripts Path Transform
 *
 * Replaces {scripts_dir} placeholder in skill body with the
 * platform-resolved scripts directory path.
 */

/**
 * Replace {scripts_dir} placeholder with platform-resolved path.
 *
 * @param {string} body - skill body text
 * @param {string} scriptsPath - resolved path for this platform
 * @returns {string} body with placeholders resolved
 */
export function resolveScriptsPath(body, scriptsPath) {
  if (!body || !scriptsPath) return body;
  return body.replaceAll('{scripts_dir}', scriptsPath);
}
