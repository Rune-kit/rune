/**
 * MCP surface for `rune serve`: tools, prompts and server instructions.
 *
 * Tools
 *   list_skills(filter?, tier?, kind?)  — discover what this server has
 *   get_skill(name)                      — SKILL.md / PACK.md + reference list
 *   get_reference(skill, path)           — one file from the skill's folder
 *   run_skill(name, input?, mode?)       — instructions framed for the caller
 *                                          to execute (default), or executed
 *                                          on the server by `--runner` (exp.)
 *
 * Prompts
 *   rune(skill, task?)                   — generic `/rune <skill> <task>`
 *   rune-<id>(task?)                     — one per user-invocable skill/pack
 */

import './polyfill.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

const DESC_LIMIT = 240;

function short(text, n = DESC_LIMIT) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

/** Human-readable reason a lookup failed, with suggestions. */
function notFound(catalog, name) {
  const sugg = catalog.suggest(name);
  return textResult(
    `No Rune skill named "${name}" on this server.${sugg.length ? ` Did you mean: ${sugg.join(', ')}?` : ''} Call list_skills to see everything available.`,
    true,
  );
}

export function buildInstructions(catalog, { runner } = {}) {
  const counts = catalog.counts();
  const tierLine = Object.entries(counts)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ');
  const entries = catalog
    .all()
    .filter((e) => e.userInvocable && (e.layer === 'L1' || e.kind === 'pack' || e.tier !== 'free'))
    .map((e) => e.id)
    .slice(0, 60);
  return [
    `This is a Rune skill server (${catalog.size} skills — ${tierLine}). Rune is a mesh of agent skills (SKILL.md playbooks) for coding, shipping, content, media, business and compliance work.`,
    'The skills live on THIS server, not on the local machine. Do not look for them on disk and do not ask the user to install Rune.',
    'When the user names a Rune skill, says "use the <x> skill", types `/rune <skill> ...` or `rune:<skill>`, or asks for work a Rune skill covers, call run_skill(name, input) and then follow the returned instructions. If unsure which skill fits, call list_skills(filter) first.',
    'Skills reference files under `references/` or `skills/` — fetch them with get_reference(skill, path) only when the instructions point to them. A `rune:<other>` mention means: call run_skill or get_skill for <other> on this server.',
    'Hooks and helper scripts do not run remotely. Work that touches the user’s repo or files is executed by you, the calling agent, with your own tools.',
    runner
      ? `Server-side execution is enabled (runner: ${runner}). run_skill with mode "execute" runs the skill on the server and returns its output; use it for self-contained deliverables (content, media, reports), not for edits to the user's local repo.`
      : '',
    entries.length ? `Entry points include: ${entries.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Frame a skill for the calling agent to execute.
 */
export function frameSkill(catalog, entry, input, { serverName = 'rune' } = {}) {
  const main = catalog.readMain(entry);
  const refs = catalog.references(entry);
  const lines = [];
  lines.push(`# Rune skill: ${entry.id} (${entry.tier}${entry.kind === 'pack' ? ' pack' : ''})`);
  lines.push('');
  lines.push(
    `You are now executing the Rune skill \`${entry.id}\`, served by the "${serverName}" MCP server. Follow the instructions below as if the skill were installed locally.`,
  );
  lines.push(
    '- Files the instructions mention under `references/`, `skills/` or similar are on the server: fetch them with get_reference(skill, path) when you reach the step that needs them.',
  );
  lines.push(
    '- `rune:<other>` means invoke another Rune skill: call run_skill("<other>", ...) on this same server (or get_skill to just read it).',
  );
  lines.push(
    '- Tool names (Read, Edit, Bash, Agent…) map to whatever equivalent tools you have. Hooks and `scripts/` do not run remotely; skip or emulate them.',
  );
  if (!entry.modelInvocable) {
    lines.push(
      '- This skill is USER-INVOKED ONLY (it can deploy, publish or otherwise act irreversibly). Proceed only if the user explicitly asked for it; otherwise stop and confirm.',
    );
  }
  if (entry.focus) {
    lines.push(
      `- The user asked for \`${entry.focus.replace(/^skills\//, '').replace(/\.md$/, '')}\`, which lives in this pack: start by calling get_reference("${entry.id}", "${entry.focus}").`,
    );
  }
  lines.push('');
  lines.push('## User input');
  lines.push('');
  lines.push(
    input && String(input).trim()
      ? String(input).trim()
      : '(none given — ask the user what they need if the skill requires input)',
  );
  lines.push('');
  lines.push(`## ${entry.mainFile}`);
  lines.push('');
  lines.push(main.text);
  if (main.truncated) lines.push(`\n[truncated at ${catalog.maxBytes} bytes of ${main.bytes}]`);
  if (refs.length) {
    lines.push('');
    lines.push(`## Available references (${refs.length}) — fetch with get_reference("${entry.id}", path)`);
    for (const r of refs.slice(0, 120)) lines.push(`- ${r}`);
    if (refs.length > 120) lines.push(`- … ${refs.length - 120} more (see get_skill)`);
  }
  return lines.join('\n');
}

/**
 * @param {{ catalog: ReturnType<import('./catalog.js').createCatalog>, version: string, serverName?: string, runner?: { name: string, run: (prompt: string, opts: object) => Promise<{ ok: boolean, output: string, exitCode: number|null, timedOut: boolean, durationMs: number }> } | null }} opts
 */
export function createRuneMcpServer({ catalog, version, serverName = 'rune', runner = null }) {
  const server = new McpServer(
    { name: serverName, title: 'Rune skills', version },
    { instructions: buildInstructions(catalog, { runner: runner?.name }) },
  );

  server.registerTool(
    'list_skills',
    {
      title: 'List Rune skills',
      description:
        'List the Rune skills available on this server (Free core, extension packs, and any installed Pro/Business tiers). Rune skills are NOT installed locally — this server is where they live. Optional filter does a keyword match over names and descriptions (e.g. "video", "deploy", "gdpr").',
      inputSchema: {
        filter: z.string().max(200).optional().describe('Keywords to match against skill names and descriptions'),
        tier: z.string().max(32).optional().describe('Only this tier: free, pro, business, custom'),
        kind: z.enum(['skill', 'pack']).optional().describe('Only core skills or only extension packs'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ filter, tier, kind }) => {
      const rows = catalog.search({ filter, tier, kind });
      if (rows.length === 0) {
        return textResult(
          `No skills matched${filter ? ` "${filter}"` : ''}. ${catalog.size} skills are available in total.`,
        );
      }
      const lines = rows.map((e) => {
        const tags = [e.tier, e.kind === 'pack' ? 'pack' : e.layer, e.modelInvocable ? null : 'user-invoked only']
          .filter(Boolean)
          .join(', ');
        const subs = e.kind === 'pack' ? catalog.aliasesFor(e.id) : [];
        return `- ${e.id} [${tags}] — ${short(e.description)}${subs.length ? ` (includes: ${subs.join(', ')})` : ''}`;
      });
      return textResult(
        `${rows.length} Rune skill(s)${filter ? ` matching "${filter}"` : ''}. Use run_skill(name, input) to use one.\n\n${lines.join('\n')}`,
      );
    },
  );

  server.registerTool(
    'get_skill',
    {
      title: 'Read a Rune skill',
      description:
        'Return a Rune skill’s full SKILL.md (or PACK.md for extension packs) plus the list of its reference files. Accepts names like "cook", "rune:cook", "/rune cook" or a pack sub-skill like "image-generator".',
      inputSchema: { name: z.string().min(1).max(120).describe('Skill name') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      catalog.refreshIfStale();
      const entry = catalog.find(name);
      if (!entry) return notFound(catalog, name);
      try {
        const main = catalog.readMain(entry);
        const refs = catalog.references(entry);
        const header = [
          `skill: ${entry.id}`,
          `tier: ${entry.tier}`,
          `kind: ${entry.kind}`,
          entry.layer ? `layer: ${entry.layer}` : null,
          entry.focus ? `focus: ${entry.focus}` : null,
          `user_invoked_only: ${!entry.modelInvocable}`,
          `references: ${refs.length}`,
        ]
          .filter(Boolean)
          .join('\n');
        return textResult(
          `${header}\n\n----- ${entry.mainFile} -----\n${main.text}${main.truncated ? `\n[truncated at ${catalog.maxBytes} bytes]` : ''}\n\n----- references -----\n${refs.length ? refs.map((r) => `- ${r}`).join('\n') : '(none)'}`,
        );
      } catch (err) {
        return textResult(`Could not read skill ${entry.id}: ${err.message}`, true);
      }
    },
  );

  server.registerTool(
    'get_reference',
    {
      title: 'Read a Rune skill reference file',
      description:
        'Read one file from a Rune skill’s folder on this server — e.g. get_reference("cook", "references/phase-3.md"). Paths are relative to the skill folder; use the paths listed by get_skill or run_skill.',
      inputSchema: {
        skill: z.string().min(1).max(120).describe('Skill name'),
        path: z.string().min(1).max(512).describe('Path relative to the skill folder, e.g. references/x.md'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ skill, path: rel }) => {
      catalog.refreshIfStale();
      const entry = catalog.find(skill);
      if (!entry) return notFound(catalog, skill);
      try {
        const out = catalog.readReference(entry, rel);
        return textResult(
          `${out.text}${out.truncated ? `\n[truncated at ${catalog.maxBytes} bytes of ${out.bytes}]` : ''}`,
        );
      } catch (err) {
        return textResult(`Cannot read "${rel}" from ${entry.id}: ${err.message}`, true);
      }
    },
  );

  const runShape = {
    name: z.string().min(1).max(120).describe('Skill name, e.g. "cook", "video-creator", "image-generator"'),
    input: z.string().max(20_000).optional().describe('What the user wants done with this skill, in their words'),
  };
  if (runner) {
    runShape.mode = z
      .enum(['instructions', 'execute'])
      .optional()
      .describe(
        '"instructions" (default): return the skill for you to execute. "execute": run it on the server with the configured agent CLI and return the output (self-contained deliverables only).',
      );
  }

  server.registerTool(
    'run_skill',
    {
      title: 'Use a Rune skill',
      description:
        'Use a Rune skill hosted on this server. Call this whenever the user says "use the <x> skill", types `/rune <skill> …`, or asks for work a Rune skill covers. Returns the skill’s instructions with the user’s input framed for you to execute now — follow them.' +
        (runner
          ? ` With mode "execute" the server runs the skill itself via ${runner.name} and returns the result.`
          : ''),
      inputSchema: runShape,
      annotations: { readOnlyHint: !runner, openWorldHint: false },
    },
    async ({ name, input, mode }) => {
      catalog.refreshIfStale();
      const entry = catalog.find(name);
      if (!entry) return notFound(catalog, name);
      let framed;
      try {
        framed = frameSkill(catalog, entry, input, { serverName });
      } catch (err) {
        return textResult(`Could not load skill ${entry.id}: ${err.message}`, true);
      }
      if (runner && mode === 'execute') {
        if (!entry.modelInvocable) {
          return textResult(
            `Skill ${entry.id} is user-invoked only (it can act irreversibly) and is never executed server-side. Use mode "instructions" and run it yourself after the user confirms.`,
            true,
          );
        }
        const res = await runner.run(framed, { skill: entry.id });
        const status = res.timedOut
          ? `timed out after ${Math.round(res.durationMs / 1000)}s`
          : `exit ${res.exitCode} in ${Math.round(res.durationMs / 1000)}s`;
        return textResult(`[rune runner: ${runner.name}, ${status}]\n\n${res.output}`, !res.ok);
      }
      return textResult(framed);
    },
  );

  // ── Prompts: slash commands ──
  server.registerPrompt(
    'rune',
    {
      title: 'Rune',
      description: 'Use any Rune skill from this server: /rune <skill> <task>',
      argsSchema: {
        skill: z.string().describe('Skill name, e.g. cook, video-creator, launch'),
        task: z.string().optional().describe('What you want done'),
      },
    },
    async ({ skill, task }) => {
      catalog.refreshIfStale();
      const entry = catalog.find(skill);
      const text = entry
        ? frameSkill(catalog, entry, task, { serverName })
        : `The user asked for Rune skill "${skill}"${task ? ` with: ${task}` : ''}. It was not found by exact name — call list_skills("${skill}") on the ${serverName} server and pick the closest match.`;
      return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    },
  );

  const seen = new Set(['rune']);
  for (const entry of catalog.all()) {
    if (!entry.userInvocable) continue;
    const promptName = `rune-${entry.id}`;
    if (seen.has(promptName)) continue;
    seen.add(promptName);
    const id = entry.id;
    server.registerPrompt(
      promptName,
      {
        title: `Rune: ${id}`,
        description: short(entry.description, 200),
        argsSchema: { task: z.string().optional().describe('What you want done') },
      },
      async ({ task }) => {
        const current = catalog.find(id) || entry;
        return {
          messages: [
            { role: 'user', content: { type: 'text', text: frameSkill(catalog, current, task, { serverName }) } },
          ],
        };
      },
    );
  }

  return server;
}
