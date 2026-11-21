/**
 * Reference Path Transform (v2.33)
 *
 * Skills keep long material in `skills/<name>/references/` (progressive
 * disclosure) and point at it with relative paths:
 *   - `references/x.md`                 → this skill's own reference
 *   - `../deploy/references/x.md`       → another skill's reference
 *   - "`completion-gate` → `references/claim-discipline.md`" (prose form,
 *     file only exists in another skill)
 *
 * Compiled output renames skill dirs (`cook` → `rune-cook`) and, on
 * single-file platforms (generic, openclaw, aider), flattens SKILL.md into
 * `<outputDir>/rune-cook.md`. This transform rewrites every such path so it
 * resolves from where the compiled skill file actually lives:
 *   - directory platforms: own refs unchanged; foreign refs → `../rune-<skill>/references/x.md`
 *   - single-file platforms: all refs → `rune-<skill>/references/x.md` (the
 *     emitter copies the folder next to the flat file)
 *
 * Paths that don't resolve to a real file are left untouched.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

const REF_PATH =
  /(^|[\s([`'"])((?:\.\.\/([a-z0-9-]+)\/)?(references\/[\w./-]+\.(?:md|json|ya?ml|py|js|mjs|cjs|sh|txt|mmd|html|css)))/g;

/**
 * @param {string} body - transformed skill body
 * @param {object} ctx
 * @param {string} ctx.skillName - source skill name (e.g. 'cook')
 * @param {Map<string,string>} ctx.skillDirs - skill name → source directory
 * @param {object} ctx.adapter - platform adapter
 * @returns {string}
 */
export function rewriteReferencePaths(body, { skillName, skillDirs, adapter }) {
  if (!adapter || adapter.name === 'claude' || !skillDirs) return body;
  const prefix = adapter.skillPrefix || '';
  const flat = !adapter.useSkillDirectories;

  const resolveOwner = (explicit, rel) => {
    if (explicit)
      return skillDirs.has(explicit) && existsSync(path.join(skillDirs.get(explicit), rel)) ? explicit : null;
    const own = skillDirs.get(skillName);
    if (own && existsSync(path.join(own, rel))) return skillName;
    const owners = [...skillDirs].filter(([, dir]) => existsSync(path.join(dir, rel))).map(([name]) => name);
    return owners.length === 1 ? owners[0] : null;
  };

  return body.replace(REF_PATH, (match, lead, _full, explicit, rel) => {
    const owner = resolveOwner(explicit, rel);
    if (!owner) return match;
    if (flat) return `${lead}${prefix}${owner}/${rel}`;
    if (owner === skillName) return `${lead}${rel}`;
    return `${lead}../${prefix}${owner}/${rel}`;
  });
}
