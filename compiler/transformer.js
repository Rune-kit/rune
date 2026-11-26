/**
 * Transform Pipeline
 *
 * Applies all transforms in order to convert a parsed skill into platform-specific output.
 * Pipeline: frontmatter → cross-refs → tool-names → runtime-paths → subagents → compliance → hooks → branding
 */

import { transformCompliance } from './transforms/compliance.js';
import { transformCrossReferences } from './transforms/cross-references.js';
import { generateHookConstraints } from './transforms/hooks.js';
import { transformRuntimePaths } from './transforms/runtime-paths.js';
import { transformSubagents } from './transforms/subagents.js';
import { transformToolNames } from './transforms/tool-names.js';

/**
 * Body-only transforms (cross-refs, tool names, runtime paths, subagents,
 * adapter post-processing) for files that ride along with a compiled skill —
 * e.g. the per-skill files of a split pack. No header, compliance preamble,
 * hook constraints or footer: those belong to the skill's own SKILL.md.
 *
 * @param {string} body
 * @param {object} adapter
 * @returns {string}
 */
export function transformBody(body, adapter) {
  if (adapter.name === 'claude') return body;
  let out = transformCrossReferences(body, adapter);
  out = transformToolNames(out, adapter);
  out = transformRuntimePaths(out, adapter);
  out = transformSubagents(out, adapter);
  return adapter.postProcess(out);
}

/**
 * Run the full transform pipeline on a parsed skill
 *
 * @param {object} parsedSkill - output from parser.parseSkill()
 * @param {object} adapter - platform adapter
 * @returns {{ header: string, body: string, footer: string }}
 */
export function transformSkill(parsedSkill, adapter) {
  // For Claude Code, return body unchanged
  if (adapter.name === 'claude') {
    return {
      header: '',
      body: parsedSkill.body,
      footer: '',
    };
  }

  let body = parsedSkill.body;

  // 1. Rewrite cross-references (rune:cook → platform-native)
  body = transformCrossReferences(body, adapter);

  // 2. Rewrite tool names (Read, Edit, Bash → generic)
  body = transformToolNames(body, adapter);

  // 2b. Claude-only working dirs (.claude/worktrees) → neutral .rune/ paths
  body = transformRuntimePaths(body, adapter);

  // 3. Convert subagent/parallel instructions to sequential
  body = transformSubagents(body, adapter);

  // 4. Inject compliance preamble (enforcement for non-Claude platforms)
  body = transformCompliance(body, adapter);

  // 5. Platform-specific post-processing
  body = adapter.postProcess(body);

  // 6. Generate header (platform-specific frontmatter/preamble)
  const header = adapter.generateHeader(parsedSkill);

  // 7. Generate hook constraints section
  const hookConstraints = generateHookConstraints(parsedSkill, adapter);

  // 8. Inject hook constraints after the first heading
  if (hookConstraints) {
    const firstHeadingEnd = body.indexOf('\n## ');
    if (firstHeadingEnd !== -1) {
      // Insert before the first ## section
      const titleSection = body.substring(0, firstHeadingEnd);
      const rest = body.substring(firstHeadingEnd);
      body = titleSection + hookConstraints + rest;
    } else {
      body = body + hookConstraints;
    }
  }

  // 9. Generate footer (branding + CTA)
  const footer = adapter.generateFooter();

  return { header, body, footer };
}
