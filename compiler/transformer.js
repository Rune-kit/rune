/**
 * Transform Pipeline
 *
 * Applies all transforms in order to convert a parsed skill into platform-specific output.
 * Pipeline: frontmatter → cross-refs → tool-names → subagents → compliance → hooks → branding
 */

import { transformCrossReferences } from './transforms/cross-references.js';
import { transformToolNames } from './transforms/tool-names.js';
import { transformFrontmatter } from './transforms/frontmatter.js';
import { transformSubagents } from './transforms/subagents.js';
import { generateHookConstraints } from './transforms/hooks.js';
import { transformCompliance } from './transforms/compliance.js';
import { addBranding } from './transforms/branding.js';

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
