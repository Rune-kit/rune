/**
 * Gemini CLI Adapter
 *
 * Gemini CLI loads a single GEMINI.md at project root for context. It does NOT
 * support per-skill imports as of writing — so the canonical output is a
 * bundled GEMINI.md with every skill concatenated under `## rune-<name>` H2
 * sections. Per-skill files are still emitted under gemini/skills/ for human
 * inspection and forward-compatibility if Gemini adds @import support later.
 *
 * Gemini context file: GEMINI.md (project root)
 * Gemini per-skill files: gemini/skills/rune-{name}.md (forward-compat staging)
 *
 * @see https://github.com/google-gemini/gemini-cli
 * @see https://geminicli.com/docs/reference/configuration/
 *
 * MODEL TIER MAPPING (v2.18+):
 * Gemini CLI exposes 1.5 Pro / 1.5 Flash / 2.0 Flash etc. Anthropic tier names
 * translate to Gemini families: opus→1.5-pro, sonnet→1.5-flash, haiku→
 * 2.0-flash-lite. Hint only — Gemini CLI reads model from --model flag /
 * config, not from rule body.
 */

import { readFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { BRANDING_FOOTER } from '../transforms/branding.js';

const MODEL_MAP = {
  opus: 'gemini-2.5-pro',
  sonnet: 'gemini-2.5-flash',
  haiku: 'gemini-2.0-flash-lite',
};

const TOOL_MAP = {
  Read: 'read the file',
  Write: 'write/create the file',
  Edit: 'edit the file',
  Glob: 'find files by pattern',
  Grep: 'search file contents',
  Bash: 'run a shell command',
  TodoWrite: 'track task progress',
  Skill: 'follow the referenced rune-{name} section in GEMINI.md',
  Agent: 'execute the workflow',
};

export default {
  name: 'gemini',
  outputDir: 'gemini/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  // Per-skill files staged for forward compat; canonical entry is bundled GEMINI.md.
  useSkillDirectories: false,

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `the rune-${skillName} section in GEMINI.md`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    const desc = (skill.description || '').replace(/"/g, '\\"');
    const lines = ['---', `name: rune-${skill.name}`, `description: "${desc}"`];
    const translatedModel = skill.model ? MODEL_MAP[skill.model] || skill.model : null;
    if (translatedModel) lines.push(`# model-hint: ${translatedModel}`);
    lines.push('---', '', '');
    return lines.join('\n');
  },

  generateFooter() {
    return BRANDING_FOOTER;
  },

  transformSubagentInstruction(text) {
    return text;
  },

  scriptsDir(skillName) {
    return `rune-${skillName}-scripts`;
  },

  postProcess(content) {
    return content.replace(/^context: fork\n/gm, '').replace(/^agent: general-purpose\n/gm, '');
  },

  // Bundle every per-skill file into a single GEMINI.md with H2 section per skill.
  // Gemini CLI loads GEMINI.md from project root as its context file. Hook contract
  // requires relative paths (resolved against outputRoot by the emitter).
  async generateExtraFiles({ stats, outputDir }) {
    const skillFiles = [...stats.files]
      .filter((f) => f.startsWith('rune-') && f.endsWith('.md') && !f.includes('/') && !f.includes('\\'))
      .sort();

    const sections = [];
    for (const fname of skillFiles) {
      const sourcePath = nodePath.join(outputDir, fname);
      try {
        const raw = await readFile(sourcePath, 'utf-8');
        // Strip frontmatter — Gemini reads plain markdown.
        const stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
        const skillName = fname.replace(/^rune-/, '').replace(/\.md$/, '');
        sections.push(`\n\n## rune-${skillName}\n\n${stripped}`);
      } catch {
        // Skip unreadable per-skill file — sections array still produces valid bundle.
      }
    }

    const geminiMd = [
      '# Rune — Project Configuration',
      '',
      'Rune is an interconnected skill ecosystem for AI coding assistants.',
      `${stats.skillCount} core skills + ${stats.packCount} extension packs, bundled below.`,
      '',
      'When a user request matches a skill\'s domain (e.g. "implement", "review", "debug"), follow the matching `## rune-<name>` section.',
      '',
      '> Per-skill files are staged in `gemini/skills/` for forward-compat if Gemini CLI adds @import support.',
      '',
      ...sections,
      '',
      '---',
      '> Rune Skill Mesh — https://github.com/rune-kit/rune',
      '',
    ].join('\n');

    return [{ path: 'GEMINI.md', content: geminiMd }];
  },
};
