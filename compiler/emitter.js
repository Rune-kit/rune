/**
 * Emitter
 *
 * Writes transformed skill files to the platform's output directory.
 * Handles file naming, directory creation, and index generation.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractCrossRefs, extractToolRefs, parsePack, parseSkill } from './parser.js';
import { transformSkill } from './transformer.js';

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
 * @returns {Promise<object>} build result stats
 */
export async function buildAll({ runeRoot, outputRoot, adapter, disabledSkills = [], enabledPacks = null }) {
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
  const packPaths = await discoverPacks(extensionsDir, enabledPacks);

  const stats = {
    platform: adapter.name,
    skillCount: 0,
    packCount: 0,
    crossRefsResolved: 0,
    toolRefsResolved: 0,
    files: [],
    skipped: [],
    errors: [],
  };

  // Build skills
  for (const skillPath of skillPaths) {
    try {
      const content = await readFile(skillPath, 'utf-8');
      const parsed = parseSkill(content, skillPath);

      // Check disabled
      if (disabledSkills.includes(parsed.name)) {
        stats.skipped.push(parsed.name);
        continue;
      }

      const { header, body, footer } = transformSkill(parsed, adapter);
      const output = [header, body, footer].filter(Boolean).join('\n');

      let outputPath;
      let displayName;

      if (adapter.useSkillDirectories) {
        // Directory-per-skill: .codex/skills/rune-{name}/SKILL.md
        const dirName = `${adapter.skillPrefix}${parsed.name}`;
        const skillDir = path.join(outputDir, dirName);
        await mkdir(skillDir, { recursive: true });
        outputPath = path.join(skillDir, adapter.skillFileName || 'SKILL.md');
        displayName = `${dirName}/${adapter.skillFileName || 'SKILL.md'}`;
      } else {
        const fileName = outputFileName(parsed.name, adapter);
        outputPath = path.join(outputDir, fileName);
        displayName = fileName;
      }

      await writeFile(outputPath, output, 'utf-8');

      stats.skillCount++;
      stats.crossRefsResolved += parsed.crossRefs.length;
      stats.toolRefsResolved += parsed.toolRefs.length;
      stats.files.push(displayName);
    } catch (err) {
      stats.errors.push({ file: skillPath, error: err.message });
    }
  }

  // Build extension packs
  for (const packPath of packPaths) {
    try {
      const content = await readFile(packPath, 'utf-8');
      const parsed = parsePack(content, packPath);
      const packName = path.basename(path.dirname(packPath));
      const packDir = path.dirname(packPath);

      // For split packs, load individual skill files and concatenate into body
      if (parsed.isSplit && parsed.skillManifest.length > 0) {
        const skillBodies = [];
        for (const skill of parsed.skillManifest) {
          const skillPath = path.join(packDir, skill.file);
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

  // OpenClaw adapter: generate manifest + TypeScript entry point
  if (adapter.name === 'openclaw' && adapter.generateManifest && adapter.generateEntryPoint) {
    const pluginJsonPath = path.join(runeRoot, '.claude-plugin', 'plugin.json');
    let pluginJson = { version: '0.0.0' };
    if (existsSync(pluginJsonPath)) {
      pluginJson = JSON.parse(await readFile(pluginJsonPath, 'utf-8'));
    }

    // Collect parsed skills for manifest/entry generation
    const parsedSkills = [];
    for (const sp of skillPaths) {
      try {
        const c = await readFile(sp, 'utf-8');
        parsedSkills.push(parseSkill(c, sp));
      } catch {
        /* skip on error */
      }
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
    `> Platform: ${adapter.name} | Skills: ${stats.skillCount} | Extensions: ${stats.packCount}`,
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
