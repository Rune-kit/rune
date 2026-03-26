/**
 * OpenClaw Adapter
 *
 * Emits an OpenClaw plugin structure:
 *   .openclaw/rune/openclaw.plugin.json  (manifest)
 *   .openclaw/rune/src/index.ts          (register entrypoint)
 *   .openclaw/rune/skills/*.md           (transformed skill files)
 *
 * Follows the NeuralMemory OpenClaw plugin pattern.
 */

import { BRANDING_FOOTER } from '../transforms/branding.js';

const TOOL_MAP = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'edit_file',
  Glob: 'glob',
  Grep: 'grep',
  Bash: 'run_command',
  TodoWrite: 'todo_write',
  Skill: 'follow the referenced skill',
  Agent: 'execute the workflow',
};

export default {
  name: 'openclaw',
  outputDir: '.openclaw/rune/skills',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',

  transformReference(skillName, raw) {
    const isBackticked = raw.startsWith('`') && raw.endsWith('`');
    const ref = `rune-${skillName}.md`;
    return isBackticked ? `\`${ref}\`` : ref;
  },

  transformToolName(toolName) {
    return TOOL_MAP[toolName] || toolName;
  },

  generateHeader(skill) {
    return `# rune-${skill.name}\n\n> Rune ${skill.layer} Skill | ${skill.group}\n\n`;
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

  /**
   * Generate openclaw.plugin.json manifest
   *
   * @param {object[]} skills - parsed skill objects
   * @param {object} pluginJson - Rune's .claude-plugin/plugin.json
   * @returns {object} manifest object
   */
  generateManifest(_skills, pluginJson) {
    return {
      id: 'rune',
      name: 'Rune',
      kind: 'skills',
      description:
        '59-skill mesh for AI coding assistants. Routes all code tasks through specialized skills. 200+ connections, 14 extension packs.',
      version: pluginJson.version || '0.0.0',
      skills: ['./skills'],
      configSchema: {
        jsonSchema: {
          type: 'object',
          properties: {
            disabledSkills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills to disable (by name)',
              default: [],
            },
          },
          additionalProperties: false,
        },
        uiHints: {
          disabledSkills: {
            label: 'Disabled Skills',
            help: 'Comma-separated list of skill names to exclude from routing',
          },
        },
      },
    };
  },

  /**
   * Generate README.md for ClawHub listing page
   *
   * @param {object[]} skills - parsed skill objects
   * @param {object} pluginJson - Rune's .claude-plugin/plugin.json
   * @returns {string} markdown content
   */
  generateReadme(skills, pluginJson) {
    const version = pluginJson.version || '0.0.0';
    const l1 = skills.filter((s) => s.layer === 'L1').map((s) => s.name);
    const l2 = skills.filter((s) => s.layer === 'L2').map((s) => s.name);
    const l3 = skills.filter((s) => s.layer === 'L3').map((s) => s.name);

    return `# Rune

> Less skills. Deeper connections.

**${skills.length}-skill mesh** for AI coding assistants — 5-layer architecture, 200+ connections, 14 extension packs.

## Install

\`\`\`
clawhub install rune-kit
\`\`\`

Or via npm:

\`\`\`
npx @rune-kit/rune init
\`\`\`

## What is Rune?

Rune is a **mesh** — skills call each other bidirectionally, forming resilient workflows. If one skill fails, the mesh routes around it.

Use \`rune:cook\` for any code task, \`rune:team\` for parallel work, \`rune:launch\` for deploy, \`rune:rescue\` for legacy code.

## Architecture

| Layer | Role | Skills |
|-------|------|--------|
| L0 | Router | skill-router |
| L1 | Orchestrators | ${l1.join(', ')} |
| L2 | Workflow Hubs | ${l2.join(', ')} |
| L3 | Utilities | ${l3.join(', ')} |
| L4 | Extensions | 14 domain packs |

## Extension Packs (L4)

ui · backend · devops · mobile · security · trading · saas · ecommerce · ai-ml · gamedev · content · analytics · chrome-ext · zalo

## Links

- **Source**: [github.com/rune-kit/rune](https://github.com/rune-kit/rune)
- **Docs**: [rune-kit.github.io/rune](https://rune-kit.github.io/rune)
- **Guides**: [rune-kit.github.io/rune/guides](https://rune-kit.github.io/rune/guides)

## License

MIT — v${version}
`;
  },

  /**
   * Generate src/index.ts entry point with register(api) pattern
   *
   * @param {object[]} skills - parsed skill objects
   * @param {string} routerContent - skill-router SKILL.md content for injection
   * @returns {string} TypeScript source
   */
  generateEntryPoint(skills, routerContent) {
    const skillNames = skills.map((s) => s.name);
    const routingTable = skills.map((s) => `//   ${s.name} (${s.layer}) — ${s.description || s.group}`).join('\n');

    // Escape backticks and backslashes in router content for template literal
    const escapedRouter = (routerContent || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `/**
 * Rune — OpenClaw Plugin Entry Point
 *
 * Auto-generated by Rune compiler.
 * Do not edit manually — regenerate with: rune build --platform openclaw
 *
 * Skills (${skillNames.length}):
${routingTable}
 */

const SKILL_ROUTER_INSTRUCTIONS = \`${escapedRouter}\`;

const plugin = {
  id: 'rune',
  name: 'Rune',

  register(api: any): void {
    // Inject skill-router instructions so the agent routes through Rune skills
    api.on('before_agent_start', async () => {
      return {
        prependSystemContext: SKILL_ROUTER_INSTRUCTIONS,
      };
    }, { priority: 5 });
  },
};

export default plugin;
`;
  },
};
