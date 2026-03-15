/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files into a structured intermediate representation (IR).
 * Extracts frontmatter, cross-references, tool references, HARD-GATE blocks, and sections.
 */

const CROSS_REF_PATTERN = /`?rune:([a-z][\w-]*)`?/g;
const TOOL_REF_PATTERN = /`(Read|Write|Edit|Glob|Grep|Bash|TodoWrite|Skill|Agent)`/g;
const HARD_GATE_PATTERN = /<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/g;
const SECTION_PATTERN = /^## (.+)$/gm;

/**
 * Parse YAML-like frontmatter from SKILL.md
 * Handles nested metadata block
 */
function parseFrontmatter(content) {
  // Normalize line endings to \n for cross-platform compatibility
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: normalized };

  const raw = match[1];
  const body = normalized.slice(match[0].length).trim();
  const frontmatter = {};

  let currentIndent = null;
  let nestedKey = null;
  const nestedObj = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect nested block (e.g., metadata:)
    if (/^\w+:\s*$/.test(trimmed)) {
      nestedKey = trimmed.replace(':', '').trim();
      frontmatter[nestedKey] = {};
      currentIndent = 'nested';
      continue;
    }

    if (currentIndent === 'nested' && line.startsWith('  ')) {
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        let value = kvMatch[2].replace(/^["']|["']$/g, '');
        frontmatter[nestedKey][kvMatch[1]] = value;
      }
      continue;
    }

    // Top-level key-value
    currentIndent = null;
    nestedKey = null;
    const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) {
      let value = kvMatch[2].replace(/^["']|["']$/g, '');
      frontmatter[kvMatch[1]] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Extract all rune:<name> cross-references from body
 */
function extractCrossRefs(body) {
  const refs = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    const regex = new RegExp(CROSS_REF_PATTERN.source, 'g');

    while ((match = regex.exec(line)) !== null) {
      refs.push({
        raw: match[0],
        skillName: match[1],
        line: i + 1,
        context: line.trim(),
      });
    }
  }

  return refs;
}

/**
 * Extract all Claude Code tool references from body
 */
function extractToolRefs(body) {
  const refs = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    const regex = new RegExp(TOOL_REF_PATTERN.source, 'g');

    while ((match = regex.exec(line)) !== null) {
      refs.push({
        raw: match[0],
        toolName: match[1],
        line: i + 1,
        context: line.trim(),
      });
    }
  }

  return refs;
}

/**
 * Extract HARD-GATE blocks
 */
function extractHardGates(body) {
  const gates = [];
  let match;
  const regex = new RegExp(HARD_GATE_PATTERN.source, 'gs');

  while ((match = regex.exec(body)) !== null) {
    gates.push(match[1].trim());
  }

  return gates;
}

/**
 * Extract ## sections as a Map<sectionName, content>
 */
function extractSections(body) {
  const sections = new Map();
  const lines = body.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join('\n').trim());
      }
      currentSection = sectionMatch[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection, currentContent.join('\n').trim());
  }

  return sections;
}

/**
 * Parse a SKILL.md file content into structured IR
 *
 * @param {string} content - raw SKILL.md content
 * @param {string} [filePath] - optional file path for error reporting
 * @returns {ParsedSkill}
 */
export function parseSkill(content, filePath = '') {
  const { frontmatter, body } = parseFrontmatter(content);

  const metadata = frontmatter.metadata || {};

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    layer: metadata.layer || 'L2',
    model: metadata.model || 'sonnet',
    group: metadata.group || 'general',
    contextFork: frontmatter.context === 'fork',
    agentType: frontmatter.agent || null,
    body,
    crossRefs: extractCrossRefs(body),
    toolRefs: extractToolRefs(body),
    hardGates: extractHardGates(body),
    sections: extractSections(body),
    filePath,
    frontmatter,
  };
}

/**
 * Parse a PACK.md extension file (same format, slightly different metadata)
 */
export function parsePack(content, filePath = '') {
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    version: frontmatter.version || '1.0.0',
    layer: 'L4',
    body,
    crossRefs: extractCrossRefs(body),
    toolRefs: extractToolRefs(body),
    hardGates: extractHardGates(body),
    sections: extractSections(body),
    filePath,
    frontmatter,
  };
}
