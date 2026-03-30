/**
 * Emitter
 *
 * Writes transformed skill files to the platform's output directory.
 * Handles file naming, directory creation, index generation, and AGENTS.md creation.
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractCrossRefs, extractToolRefs, parseOrgConfig, parsePack, parseSkill, parseTemplate } from './parser.js';
import { transformSkill } from './transformer.js';
import { resolveScriptsPath } from './transforms/scripts-path.js';

/**
 * Discover all SKILL.md files in the skills directory
 *
 * @param {string} skillsDir - path to skills/ directory
 * @returns {Promise<string[]>} array of SKILL.md file paths
 */
async function discoverSkills(skillsDir) {
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (existsSync(skillFile)) {
      paths.push(skillFile);
    }
  }

  return paths.sort();
}

/**
 * Discover all PACK.md files in the extensions directory
 *
 * @param {string} extensionsDir - path to extensions/ directory
 * @param {string[]} [enabledPacks] - list of enabled pack names (null = all)
 * @returns {Promise<string[]>} array of PACK.md file paths
 */
async function discoverPacks(extensionsDir, enabledPacks = null) {
  if (!existsSync(extensionsDir)) return [];

  const entries = await readdir(extensionsDir, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (enabledPacks && !enabledPacks.includes(entry.name) && !enabledPacks.includes(`@rune/${entry.name}`)) {
      continue;
    }
    const packFile = path.join(extensionsDir, entry.name, 'PACK.md');
    if (existsSync(packFile)) {
      paths.push(packFile);
    }
  }

  return paths.sort();
}

/**
 * Copy extra directories from skill source to output
 * Copies directories except SKILL.md (already processed) and denylisted dirs
 *
 * @param {string} sourceSkillDir - e.g. skills/cook/
 * @param {string} outputSkillDir - e.g. .codex/skills/rune-cook/
 * @returns {Promise<string[]>} list of copied directory names
 */
const COPY_DENYLIST = new Set(['.git', 'node_modules', '__pycache__', '.DS_Store', '.venv', '.env']);

async function copySkillExtraDirs(sourceSkillDir, outputSkillDir) {
  if (!existsSync(sourceSkillDir)) return [];

  const entries = await readdir(sourceSkillDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !COPY_DENYLIST.has(e.name));

  const copied = [];
  for (const dir of dirs) {
    const sourcePath = path.join(sourceSkillDir, dir.name);
    const outputPath = path.join(outputSkillDir, dir.name);
    await cp(sourcePath, outputPath, { recursive: true });
    copied.push(dir.name);
  }

  return copied;
}

/**
 * Copy scripts directory from skill source to output.
 *
 * @param {string} sourceScriptsDir - e.g. skills/slides/scripts/
 * @param {string} outputScriptsDir - e.g. .cursor/rules/rune-slides-scripts/
 * @returns {Promise<string[]>} list of copied file paths
 */
async function copyScriptsDir(sourceScriptsDir, outputScriptsDir) {
  if (!existsSync(sourceScriptsDir)) return [];

  const entries = await readdir(sourceScriptsDir, { recursive: true, withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  if (entries.length === 0) return [];

  await cp(sourceScriptsDir, outputScriptsDir, { recursive: true });

  // Return relative paths within the scripts dir (same structure as source after recursive cp)
  return files.map((e) => {
    const parent = e.parentPath || e.path;
    return path.relative(sourceScriptsDir, path.join(parent, e.name));
  });
}

/**
 * Tier priority: higher number = higher priority (wins override)
 */
const TIER_PRIORITY = { free: 0, pro: 1, business: 2 };

/**
 * Normalize pack name for tier comparison.
 * Strips tier prefixes (pro-, business-) so packs can be compared across tiers.
 * e.g. "pro-product" → "product", "saas" → "saas"
 */
function normalizePackName(dirName) {
  return dirName.replace(/^(pro|business)-/, '');
}

/**
 * Discover packs across multiple tier sources and resolve overrides.
 * Business > Pro > Free: if the same normalized pack name exists in multiple tiers,
 * the highest-priority tier wins.
 *
 * @param {string} freeExtDir - path to free extensions/ directory
 * @param {Object<string, string>} [tierSources] - { pro: "/path/to/pro/extensions", business: "/path/to/business/extensions" }
 * @param {string[]} [enabledPacks] - list of enabled pack names (null = all)
 * @returns {Promise<Array<{path: string, tier: string, dirName: string}>>} resolved pack entries
 */
export async function discoverTieredPacks(freeExtDir, tierSources = {}, enabledPacks = null) {
  // Collect all packs with their tier info: Map<normalizedName, {path, tier, priority, dirName}>
  const packMap = new Map();

  // Helper: scan one extensions directory for packs
  async function scanDir(extDir, tier) {
    if (!existsSync(extDir)) return;
    const entries = await readdir(extDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (enabledPacks && !enabledPacks.includes(entry.name) && !enabledPacks.includes(`@rune/${entry.name}`)) {
        continue;
      }
      const packFile = path.join(extDir, entry.name, 'PACK.md');
      if (!existsSync(packFile)) continue;

      const normalized = normalizePackName(entry.name);
      const priority = TIER_PRIORITY[tier] ?? 0;
      const existing = packMap.get(normalized);

      // Higher priority tier wins — track overridden lower-tier entries for skill-level merging
      if (!existing || priority > existing.priority) {
        const overrides = existing
          ? [...(existing.overrides || []), { path: existing.path, tier: existing.tier, dirName: existing.dirName }]
          : [];
        packMap.set(normalized, { path: packFile, tier, priority, dirName: entry.name, overrides });
      }
    }
  }

  // Scan free first (lowest priority), then pro, then business
  await scanDir(freeExtDir, 'free');
  if (tierSources.pro) {
    await scanDir(tierSources.pro, 'pro');
  }
  if (tierSources.business) {
    await scanDir(tierSources.business, 'business');
  }

  // Return sorted by dirName for deterministic output
  return [...packMap.values()].sort((a, b) => a.dirName.localeCompare(b.dirName));
}

/**
 * Discover workflow templates in a pack's templates/ directory
 *
 * @param {string} packDir - path to the pack directory (e.g. extensions/pro-product/)
 * @returns {Promise<Array<{name: string, file: string, parsed: object}>>} array of parsed templates
 */
async function discoverTemplates(packDir) {
  const templatesDir = path.join(packDir, 'templates');
  if (!existsSync(templatesDir)) return [];

  const entries = await readdir(templatesDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const filePath = path.join(templatesDir, entry.name);
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseTemplate(content, filePath);
    templates.push({
      name: parsed.name || entry.name.replace(/\.md$/, ''),
      file: `templates/${entry.name}`,
      parsed,
    });
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load reference injection rules from all tier extension directories.
 * Each pack can have an inject.json file defining which references to inject
 * into Free core skills when that pack is installed.
 *
 * @param {string} freeExtDir - path to free extensions/ directory
 * @param {Object<string, string>} tierSources - { pro: "/path", business: "/path" }
 * @returns {Promise<Map<string, Array<{ref: string, context: string, packDir: string}>>>}
 *   Map of skillName → array of injections
 */
async function loadInjectionRules(freeExtDir, tierSources) {
  const injections = new Map(); // skillName → [{ref, context, packDir}]

  const extDirs = [freeExtDir, tierSources.pro, tierSources.business].filter(Boolean);

  for (const extDir of extDirs) {
    if (!existsSync(extDir)) continue;
    const entries = await readdir(extDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const injectFile = path.join(extDir, entry.name, 'inject.json');
      if (!existsSync(injectFile)) continue;

      try {
        const raw = await readFile(injectFile, 'utf-8');
        const config = JSON.parse(raw);
        const packDir = path.join(extDir, entry.name);

        for (const rule of config.injections || []) {
          if (!rule.skill || !rule.ref) continue;
          if (!injections.has(rule.skill)) {
            injections.set(rule.skill, []);
          }
          injections.get(rule.skill).push({
            ref: rule.ref,
            context: rule.context || '',
            packDir,
            pack: entry.name,
          });
        }
      } catch {
        // Invalid JSON — skip gracefully
      }
    }
  }

  return injections;
}

/**
 * Apply reference injections to a skill's body.
 * Reads the referenced files and appends them as context blocks.
 *
 * @param {string} body - original skill body
 * @param {Array<{ref: string, context: string, packDir: string}>} rules - injection rules
 * @returns {Promise<{body: string, count: number}>} injected body + count of injections applied
 */
async function applyInjections(body, rules) {
  const blocks = [];

  for (const rule of rules) {
    const refPath = path.join(rule.packDir, rule.ref);
    if (!existsSync(refPath)) continue;

    try {
      const content = await readFile(refPath, 'utf-8');
      // Strip frontmatter if present
      const cleaned = content.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      blocks.push(
        `\n\n<!-- Pro Reference: ${rule.pack}/${rule.ref} -->\n` +
        `<CONTEXT-INJECTION source="${rule.pack}" context="${rule.context}">\n` +
        `${cleaned}\n` +
        `</CONTEXT-INJECTION>`
      );
    } catch {
      // Unreadable reference — skip
    }
  }

  return { body: body + blocks.join(''), count: blocks.length };
}

/**
 * Load org config from .rune/org/org.md if it exists.
 * Returns parsed org config or null if not present.
 */
async function loadOrgConfig(runeRoot, tierSources) {
  // Org templates are a Business feature — only load if business tier is available
  if (!tierSources || !tierSources.business) return null;

  const orgPath = path.join(runeRoot, '.rune', 'org', 'org.md');
  if (!existsSync(orgPath)) return null;

  try {
    const content = await readFile(orgPath, 'utf-8');
    return parseOrgConfig(content, orgPath);
  } catch {
    return null;
  }
}

/**
 * Generate <ORG-POLICY> block from org config for injection into sentinel/preflight.
 */
function buildOrgPolicyBlock(orgConfig, targetSkill) {
  if (!orgConfig) return null;

  const lines = [];
  lines.push(`\n\n<!-- Business: Organization Policy (${orgConfig.name}) -->`);
  lines.push(`<ORG-POLICY template="${orgConfig.name}" governance="${orgConfig.governanceLevel.level}">`);

  if (targetSkill === 'sentinel') {
    // Inject security + code review + deployment policies
    const security = orgConfig.policies.security || [];
    const codeReview = orgConfig.policies.code_review || [];
    const deployment = orgConfig.policies.deployment || [];

    if (security.length > 0) {
      lines.push('\n### Security Policies');
      for (const rule of security) {
        lines.push(`- **${rule.key}**: ${rule.value}`);
      }
    }
    if (codeReview.length > 0) {
      lines.push('\n### Code Review Policies');
      for (const rule of codeReview) {
        lines.push(`- **${rule.key}**: ${rule.value}`);
      }
    }
    if (deployment.length > 0) {
      lines.push('\n### Deployment Policies');
      for (const rule of deployment) {
        lines.push(`- **${rule.key}**: ${rule.value}`);
      }
    }
  } else if (targetSkill === 'preflight') {
    // Inject code review + deployment + approval flows
    const codeReview = orgConfig.policies.code_review || [];
    const deployment = orgConfig.policies.deployment || [];

    if (codeReview.length > 0) {
      lines.push('\n### Code Review Requirements');
      for (const rule of codeReview) {
        lines.push(`- **${rule.key}**: ${rule.value}`);
      }
    }
    if (deployment.length > 0) {
      lines.push('\n### Deployment Requirements');
      for (const rule of deployment) {
        lines.push(`- **${rule.key}**: ${rule.value}`);
      }
    }

    // Include approval flows
    const flows = orgConfig.approvalFlows;
    if (Object.keys(flows).length > 0) {
      lines.push('\n### Approval Flows');
      for (const [name, flow] of Object.entries(flows)) {
        lines.push(`\n**${name}**:`);
        lines.push('```');
        lines.push(flow);
        lines.push('```');
      }
    }
  }

  // Governance settings
  const gov = orgConfig.governanceLevel;
  if (gov.settings.length > 0) {
    lines.push('\n### Governance Settings');
    for (const setting of gov.settings) {
      lines.push(`- ${setting}`);
    }
  }

  lines.push('</ORG-POLICY>');
  return lines.join('\n');
}

/**
 * Generate output filename for a skill
 */
function outputFileName(skillName, adapter) {
  return `${adapter.skillPrefix}${skillName}${adapter.skillSuffix}${adapter.fileExtension}`;
}

/**
 * Build all skills for a target platform
 *
 * @param {object} options
 * @param {string} options.runeRoot - root of the Rune repo
 * @param {string} options.outputRoot - where to write output (project root or dist/)
 * @param {object} options.adapter - platform adapter
 * @param {string[]} [options.disabledSkills] - skills to skip
 * @param {string[]} [options.enabledPacks] - extension packs to include (null = all)
 * @param {Object<string, string>} [options.tierSources] - tier extension dirs { pro: "path", business: "path" }
 * @returns {Promise<object>} build result stats
 */
export async function buildAll({
  runeRoot,
  outputRoot,
  adapter,
  disabledSkills = [],
  enabledPacks = null,
  tierSources = {},
}) {
  // Claude Code = passthrough, no build needed
  if (adapter.name === 'claude') {
    return {
      platform: 'claude',
      message: 'Claude Code uses source SKILL.md files directly. No compilation needed.',
      skillCount: 0,
      packCount: 0,
      files: [],
    };
  }

  const skillsDir = path.join(runeRoot, 'skills');
  const extensionsDir = path.join(runeRoot, 'extensions');
  const outputDir = path.join(outputRoot, adapter.outputDir);

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const skillPaths = await discoverSkills(skillsDir);

  // Tier-aware pack discovery: if tierSources provided, resolve overrides
  const hasTiers = tierSources && (tierSources.pro || tierSources.business);
  const packEntries = hasTiers
    ? await discoverTieredPacks(extensionsDir, tierSources, enabledPacks)
    : (await discoverPacks(extensionsDir, enabledPacks)).map((p) => ({
        path: p,
        tier: 'free',
        dirName: path.basename(path.dirname(p)),
      }));

  const stats = {
    platform: adapter.name,
    skillCount: 0,
    packCount: 0,
    crossRefsResolved: 0,
    toolRefsResolved: 0,
    scriptsCopied: 0,
    templateCount: 0,
    injectionsApplied: 0,
    files: [],
    skipped: [],
    errors: [],
    tierOverrides: [],
  };

  // Load reference injection rules from Pro/Business packs
  const injectionRules = hasTiers ? await loadInjectionRules(extensionsDir, tierSources) : new Map();

  // Load org config from .rune/org/org.md (Business feature)
  const orgConfig = await loadOrgConfig(runeRoot, tierSources);

  // Build skills — collect parsed data for skill-index + openclaw reuse
  const parsedSkills = [];

  for (const skillPath of skillPaths) {
    try {
      const content = await readFile(skillPath, 'utf-8');
      const parsed = parseSkill(content, skillPath);

      // Check disabled
      if (disabledSkills.includes(parsed.name)) {
        stats.skipped.push(parsed.name);
        continue;
      }

      const { header, body: rawBody, footer } = transformSkill(parsed, adapter);

      // Resolve {scripts_dir} placeholder if adapter supports scripts
      const skillSourceDir = path.dirname(skillPath);
      const scriptsSource = path.join(skillSourceDir, 'scripts');
      const hasScripts = existsSync(scriptsSource) && adapter.scriptsDir;
      const scriptsRelPath = hasScripts
        ? path.join(adapter.outputDir, adapter.scriptsDir(parsed.name)).replaceAll('\\', '/')
        : null;
      const body = hasScripts ? resolveScriptsPath(rawBody, scriptsRelPath) : rawBody;

      // Warn if {scripts_dir} placeholder exists but no scripts/ folder to resolve it
      if (!hasScripts && rawBody.includes('{scripts_dir}')) {
        stats.errors.push({
          file: skillPath,
          error: `{scripts_dir} placeholder found but no scripts/ directory exists for skill "${parsed.name}"`,
        });
      }

      // Apply reference injections from Pro/Business packs
      let finalBody = body;
      if (injectionRules.has(parsed.name)) {
        const { body: injectedBody, count } = await applyInjections(body, injectionRules.get(parsed.name));
        finalBody = injectedBody;
        stats.injectionsApplied += count;
      }

      // Inject org policies into sentinel/preflight (Business feature)
      if (orgConfig && (parsed.name === 'sentinel' || parsed.name === 'preflight')) {
        const orgBlock = buildOrgPolicyBlock(orgConfig, parsed.name);
        if (orgBlock) {
          finalBody += orgBlock;
          stats.orgPoliciesInjected = (stats.orgPoliciesInjected || 0) + 1;
        }
      }

      const output = [header, finalBody, footer].filter(Boolean).join('\n');

      let outputPath;
      let displayName;
      let skillDir = null;

      if (adapter.useSkillDirectories) {
        // Directory-per-skill: .codex/skills/rune-{name}/SKILL.md
        const dirName = `${adapter.skillPrefix}${parsed.name}`;
        skillDir = path.join(outputDir, dirName);
        await mkdir(skillDir, { recursive: true });
        outputPath = path.join(skillDir, adapter.skillFileName || 'SKILL.md');
        displayName = `${dirName}/${adapter.skillFileName || 'SKILL.md'}`;
      } else {
        const fileName = outputFileName(parsed.name, adapter);
        outputPath = path.join(outputDir, fileName);
        displayName = fileName;
      }

      await writeFile(outputPath, output, 'utf-8');

      // Copy extra directories (references/, etc.) from skill source
      if (adapter.useSkillDirectories && skillDir) {
        await copySkillExtraDirs(skillSourceDir, skillDir);
      }

      // Copy scripts/ directory if present
      if (hasScripts) {
        const scriptsOutput = path.join(outputDir, adapter.scriptsDir(parsed.name));
        const copied = await copyScriptsDir(scriptsSource, scriptsOutput);
        stats.scriptsCopied += copied.length;
      }

      parsedSkills.push(parsed);
      stats.skillCount++;
      stats.crossRefsResolved += parsed.crossRefs.length;
      stats.toolRefsResolved += parsed.toolRefs.length;
      stats.files.push(displayName);
    } catch (err) {
      stats.errors.push({ file: skillPath, error: err.message });
    }
  }

  // Build extension packs (tier-aware)
  for (const packEntry of packEntries) {
    try {
      const packPath = packEntry.path;
      const content = await readFile(packPath, 'utf-8');
      const parsed = parsePack(content, packPath);
      const packName = packEntry.dirName;
      const packDir = path.dirname(packPath);

      // Track tier overrides for reporting
      if (packEntry.tier !== 'free') {
        stats.tierOverrides.push({ pack: packName, tier: packEntry.tier });
      }

      // Tier Override: merge skill manifests from lower tiers
      // If a Pro/Business pack overrides a Free pack, inherit skills the higher tier doesn't provide
      if (packEntry.overrides?.length > 0 && parsed.isSplit && parsed.skillManifest.length > 0) {
        const winnerSkillNames = new Set(parsed.skillManifest.map((s) => s.name));
        for (const lower of packEntry.overrides) {
          try {
            const lowerContent = await readFile(lower.path, 'utf-8');
            const lowerParsed = parsePack(lowerContent, lower.path);
            if (lowerParsed.isSplit) {
              const lowerPackDir = path.dirname(lower.path);
              for (const lowerSkill of lowerParsed.skillManifest) {
                if (!winnerSkillNames.has(lowerSkill.name)) {
                  // Inherit skill from lower tier — track source directory for file resolution
                  parsed.skillManifest.push({ ...lowerSkill, _sourceDir: lowerPackDir });
                  winnerSkillNames.add(lowerSkill.name);
                  stats.tierOverrides.push({ pack: packName, skill: lowerSkill.name, inherited: lower.tier });
                }
              }
            }
          } catch {
            // Lower-tier pack unreadable — skip gracefully
          }
        }
      }

      // For split packs: auto-discover skill files from skills/ subdir when manifest is empty
      if (parsed.isSplit && parsed.skillManifest.length === 0) {
        const skillsSubdir = path.join(packDir, 'skills');
        if (existsSync(skillsSubdir)) {
          const skillFiles = (await readdir(skillsSubdir)).filter((f) => f.endsWith('.md')).sort();
          for (const sf of skillFiles) {
            parsed.skillManifest.push({ name: sf.replace(/\.md$/, ''), file: `skills/${sf}` });
          }
        }
      }

      // For split packs, load individual skill files and concatenate into body
      if (parsed.isSplit && parsed.skillManifest.length > 0) {
        const skillBodies = [];
        for (const skill of parsed.skillManifest) {
          // Resolve skill file path — use _sourceDir for inherited lower-tier skills
          const sourceDir = skill._sourceDir || packDir;
          const skillPath = path.join(sourceDir, skill.file);
          if (existsSync(skillPath)) {
            const skillContent = await readFile(skillPath, 'utf-8');
            // Strip frontmatter from skill file — we only need the body
            const skillBodyMatch = skillContent.replace(/\r\n/g, '\n').match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
            const skillBody = skillBodyMatch ? skillBodyMatch[1].trim() : skillContent.trim();
            skillBodies.push(skillBody);
          } else {
            stats.errors.push({ file: skillPath, error: `Skill file not found (listed in ${packPath} manifest)` });
          }
        }
        // Concatenate: index body + all skill bodies
        parsed.body = `${parsed.body}\n\n${skillBodies.join('\n\n---\n\n')}`;
        // Re-extract refs from the full concatenated body
        parsed.crossRefs = extractCrossRefs(parsed.body);
        parsed.toolRefs = extractToolRefs(parsed.body);
      }

      // Discover and append workflow templates (Pro/Business packs)
      const templates = await discoverTemplates(packDir);
      if (templates.length > 0) {
        const templateSection = [
          '',
          '## Workflow Templates',
          '',
          'Pre-built multi-phase workflows for `cook --template <name>`:',
          '',
          ...templates.map(
            (t) =>
              `| \`${t.name}\` | ${t.parsed.description.slice(0, 100)} | chain: ${t.parsed.chain} |`,
          ),
          '',
          ...templates.map((t) => {
            const header = `### Template: ${t.name}`;
            return `${header}\n\n${t.parsed.body}`;
          }),
        ];
        parsed.body = `${parsed.body}\n\n${templateSection.join('\n')}`;
        // Re-extract refs after template injection
        parsed.crossRefs = extractCrossRefs(parsed.body);
        parsed.toolRefs = extractToolRefs(parsed.body);
        stats.templateCount = (stats.templateCount || 0) + templates.length;
      }

      // Normalize pack name for headers (ext-trading instead of @rune/trading)
      parsed.name = `ext-${packName}`;

      const { header, body, footer } = transformSkill(parsed, adapter);
      const output = [header, body, footer].filter(Boolean).join('\n');

      let outputPath;
      let displayName;

      if (adapter.useSkillDirectories) {
        const dirName = `${adapter.skillPrefix}ext-${packName}`;
        const outPackDir = path.join(outputDir, dirName);
        await mkdir(outPackDir, { recursive: true });
        outputPath = path.join(outPackDir, adapter.skillFileName || 'SKILL.md');
        displayName = `${dirName}/${adapter.skillFileName || 'SKILL.md'}`;
      } else {
        const fileName = outputFileName(`ext-${packName}`, adapter);
        outputPath = path.join(outputDir, fileName);
        displayName = fileName;
      }

      await writeFile(outputPath, output, 'utf-8');

      stats.packCount++;
      stats.files.push(displayName);
    } catch (err) {
      stats.errors.push({ file: packPath, error: err.message });
    }
  }

  // Generate index file
  const indexContent = generateIndex(stats, adapter);
  const indexFileName = outputFileName('index', adapter);
  await writeFile(path.join(outputDir, indexFileName), indexContent, 'utf-8');
  stats.files.push(indexFileName);

  // Generate skill-index.json — compiled intent mesh for auto-trigger hooks
  const skillIndex = generateSkillIndex(parsedSkills);
  await writeFile(path.join(outputDir, 'skill-index.json'), `${JSON.stringify(skillIndex, null, 2)}\n`, 'utf-8');
  stats.files.push('skill-index.json');

  // Generate AGENTS.md for Codex (OpenAI convention — not used by other platforms)
  if (adapter.name === 'codex') {
    const agentsMdContent = generateAgentsMd(stats, adapter);
    await writeFile(path.join(outputRoot, 'AGENTS.md'), agentsMdContent, 'utf-8');
    stats.files.push('AGENTS.md');
  }

  // OpenClaw adapter: generate manifest + TypeScript entry point
  if (adapter.name === 'openclaw' && adapter.generateManifest && adapter.generateEntryPoint) {
    const pluginJsonPath = path.join(runeRoot, '.claude-plugin', 'plugin.json');
    let pluginJson = { version: '0.0.0' };
    if (existsSync(pluginJsonPath)) {
      pluginJson = JSON.parse(await readFile(pluginJsonPath, 'utf-8'));
    }

    // Read skill-router content for system prompt injection
    const routerPath = path.join(runeRoot, 'skills', 'skill-router', 'SKILL.md');
    let routerContent = '';
    if (existsSync(routerPath)) {
      routerContent = await readFile(routerPath, 'utf-8');
    }

    // Write openclaw.plugin.json to parent of skills dir (.openclaw/rune/)
    const openclawRoot = path.resolve(outputDir, '..');
    const manifest = adapter.generateManifest(parsedSkills, pluginJson);
    await writeFile(path.join(openclawRoot, 'openclaw.plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    stats.files.push('openclaw.plugin.json');

    // Write src/index.ts entry point
    const srcDir = path.join(openclawRoot, 'src');
    await mkdir(srcDir, { recursive: true });
    const entryPoint = adapter.generateEntryPoint(parsedSkills, routerContent);
    await writeFile(path.join(srcDir, 'index.ts'), entryPoint, 'utf-8');
    stats.files.push('src/index.ts');

    // Write README.md + SKILL.md for ClawHub listing page
    if (adapter.generateReadme) {
      const readme = adapter.generateReadme(parsedSkills, pluginJson);
      await writeFile(path.join(openclawRoot, 'README.md'), readme, 'utf-8');
      stats.files.push('README.md');
      // SKILL.md required by clawhub publish
      await writeFile(path.join(openclawRoot, 'SKILL.md'), readme, 'utf-8');
      stats.files.push('SKILL.md');
    }
  }

  return stats;
}

/**
 * Generate an index file listing all compiled skills
 */
function generateIndex(stats, adapter) {
  const lines = [
    '# Rune Skill Index',
    '',
    `> Platform: ${adapter.name} | Skills: ${stats.skillCount} | Extensions: ${stats.packCount}${stats.templateCount > 0 ? ` | Templates: ${stats.templateCount}` : ''}${stats.injectionsApplied > 0 ? ` | Injections: ${stats.injectionsApplied}` : ''}`,
    '',
    '## Core Skills',
    '',
    ...stats.files.filter((f) => !f.match(/[-/]ext-/) && !f.includes('index')).map((f) => `- ${f}`),
    '',
  ];

  const extFiles = stats.files.filter((f) => f.match(/[-/]ext-/));
  if (extFiles.length > 0) {
    lines.push('## Extension Packs', '', ...extFiles.map((f) => `- ${f}`), '');
  }

  lines.push('---', '> Rune Skill Mesh — https://github.com/rune-kit/rune');

  return lines.join('\n');
}

/**
 * Generate AGENTS.md for Codex (OpenAI convention)
 * Uses dynamic counts from build stats — no hardcoded skill lists
 */
function generateAgentsMd(stats, adapter) {
  const lines = [
    '# Rune — Project Configuration',
    '',
    '## Overview',
    '',
    'Rune is an interconnected skill ecosystem for AI coding assistants.',
    `${stats.skillCount} core skills | 5-layer mesh architecture | ${stats.crossRefsResolved} connections | Multi-platform.`,
    'Philosophy: "Less skills. Deeper connections."',
    '',
    `Platform: ${adapter.name}`,
    '',
    '## Skills',
    '',
    `**${stats.skillCount} core skills** + **${stats.packCount} extension packs**`,
    '',
    '## Usage',
    '',
    'Reference skills using the `Skill` tool or delegate to subagents using the `Agent` tool.',
    '',
    '## Skills Directory',
    '',
    `Skills are located in: ${adapter.outputDir}/`,
    '',
    '---',
    '> Rune Skill Mesh — https://github.com/rune-kit/rune',
    '',
  ];

  return lines.join('\n');
}

/**
 * Intent keyword patterns for each skill — extracted from description + Triggers section
 * Maps common user intent words to the skill that handles them
 */
const INTENT_KEYWORDS = {
  cook: ['implement', 'build', 'create', 'add', 'feature', 'fix', 'code', 'write', 'make', 'develop'],
  team: ['parallel', 'split', 'multiple', 'large', 'many files', 'multi-module'],
  launch: ['deploy', 'launch', 'release', 'ship', 'publish', 'production'],
  rescue: ['legacy', 'refactor', 'modernize', 'rescue', 'clean up', 'old code', 'messy'],
  scaffold: ['new project', 'bootstrap', 'scaffold', 'init', 'greenfield', 'starter'],
  plan: ['plan', 'architect', 'design system', 'roadmap', 'strategy'],
  brainstorm: ['brainstorm', 'explore', 'ideas', 'alternatives', 'approaches'],
  debug: ['debug', 'error', 'bug', 'broken', 'trace', 'diagnose', 'crash', 'fail'],
  fix: ['fix', 'patch', 'hotfix', 'resolve', 'repair'],
  test: ['test', 'tdd', 'coverage', 'unit test', 'e2e', 'spec'],
  review: ['review', 'code review', 'check quality', 'audit code'],
  sentinel: ['security', 'vulnerability', 'owasp', 'secret', 'audit security'],
  preflight: ['pre-commit', 'quality gate', 'check before'],
  deploy: ['deploy', 'ci/cd', 'pipeline', 'kubernetes', 'docker'],
  design: ['ui', 'ux', 'design', 'layout', 'component design', 'wireframe'],
  perf: ['performance', 'slow', 'optimize', 'n+1', 'memory leak', 'bundle size'],
  db: ['database', 'migration', 'schema', 'sql', 'query', 'index'],
  audit: ['audit', 'health check', 'project assessment', 'codebase review'],
  onboard: ['onboard', 'setup', 'configure project', 'get started'],
  docs: ['document', 'readme', 'api docs', 'changelog'],
  ba: ['requirements', 'business analysis', 'user stories', 'stakeholder'],
  adversary: ['red team', 'challenge', 'stress test', 'edge case'],
  incident: ['incident', 'outage', 'downtime', 'postmortem'],
  surgeon: ['refactor', 'extract', 'strangler', 'decompose'],
  'mcp-builder': ['mcp', 'mcp server', 'tool server', 'model context'],
  'skill-forge': ['new skill', 'create skill', 'edit skill'],
  'review-intake': ['pr feedback', 'review comments', 'received review'],
  'logic-guardian': ['business logic', 'protect logic', 'critical path'],
  marketing: ['marketing', 'landing page', 'seo', 'social media', 'copy'],
  retro: ['retrospective', 'sprint review', 'velocity', 'team health'],
};

/**
 * Generate skill-index.json — compiled intent mesh for runtime auto-trigger
 *
 * Extracts from parsed skills: name, description, layer, model, group,
 * cross-references (connections), and maps intent keywords to skill chains.
 *
 * @param {Array} parsedSkills - array of parsed skill objects
 * @returns {object} skill index with graph + intents
 */
function generateSkillIndex(parsedSkills) {
  // Build adjacency graph from cross-references
  const graph = {};
  const skills = {};

  for (const skill of parsedSkills) {
    const outbound = [...new Set(skill.crossRefs.map((r) => r.skillName))];
    graph[skill.name] = outbound;
    skills[skill.name] = {
      layer: skill.layer,
      model: skill.model,
      group: skill.group,
      description: skill.description.slice(0, 200),
      connections: outbound,
      ...(skill.signals ? { signals: skill.signals } : {}),
    };
  }

  // Build signal graph — maps each signal to its emitters and listeners
  const signalGraph = buildSignalGraph(parsedSkills);

  // Build intent patterns from INTENT_KEYWORDS + skill descriptions
  const intents = {};
  for (const [skillName, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (!skills[skillName]) continue;
    const skill = skills[skillName];

    // Build chain: primary skill + its direct connections (1-hop)
    const chain = [skillName, ...graph[skillName].filter((c) => skills[c]).slice(0, 5)];

    intents[skillName] = {
      keywords,
      layer: skill.layer,
      model: skill.model,
      chain,
    };
  }

  return {
    version: 2,
    generated: new Date().toISOString(),
    skillCount: parsedSkills.length,
    skills,
    graph,
    signals: signalGraph,
    intents,
  };
}

/**
 * Build signal graph from parsed skills' emit/listen declarations.
 * Maps each signal name to its emitters and listeners.
 *
 * @param {Array} parsedSkills
 * @returns {object} { "code.changed": { emitters: ["fix"], listeners: ["test", "review"] } }
 */
function buildSignalGraph(parsedSkills) {
  const signals = {};

  for (const skill of parsedSkills) {
    if (!skill.signals) continue;

    for (const signal of skill.signals.emit) {
      if (!signals[signal]) signals[signal] = { emitters: [], listeners: [] };
      signals[signal].emitters.push(skill.name);
    }

    for (const signal of skill.signals.listen) {
      if (!signals[signal]) signals[signal] = { emitters: [], listeners: [] };
      signals[signal].listeners.push(skill.name);
    }
  }

  // Sort for deterministic output
  for (const entry of Object.values(signals)) {
    entry.emitters.sort();
    entry.listeners.sort();
  }

  return signals;
}
