/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files into a structured intermediate representation (IR).
 * Extracts frontmatter, cross-references, tool references, HARD-GATE blocks, and sections.
 */

/**
 * Metadata fields that should be parsed as comma-separated arrays
 * e.g. emit: code.changed, tests.passed → ["code.changed", "tests.passed"]
 */
const COMMA_LIST_FIELDS = new Set(['emit', 'listen']);

const CROSS_REF_PATTERN = /`?rune:([a-z][\w-]*)`?/g;
const TOOL_REF_PATTERN = /`(Read|Write|Edit|Glob|Grep|Bash|TodoWrite|Skill|Agent)`/g;
const HARD_GATE_PATTERN = /<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/g;
const _SECTION_PATTERN = /^## (.+)$/gm;

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
  const _nestedObj = {};

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
      // YAML list item (e.g. "  - value")
      const listMatch = trimmed.match(/^-\s+(.+)$/);
      if (listMatch) {
        // Convert nested block to array if not already
        if (!Array.isArray(frontmatter[nestedKey])) {
          frontmatter[nestedKey] = [];
        }
        frontmatter[nestedKey].push(listMatch[1].replace(/^["']|["']$/g, ''));
        continue;
      }

      const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
      if (kvMatch) {
        const rawValue = kvMatch[2].replace(/^["']|["']$/g, '');
        // Comma-separated list fields → parse as array
        if (COMMA_LIST_FIELDS.has(kvMatch[1])) {
          frontmatter[nestedKey][kvMatch[1]] = rawValue
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          frontmatter[nestedKey][kvMatch[1]] = rawValue;
        }
      }
      continue;
    }

    // Top-level key-value
    currentIndent = null;
    nestedKey = null;
    const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) {
      const value = kvMatch[2].replace(/^["']|["']$/g, '');
      // Comma-separated list fields at top level too (Pro/Business packs)
      if (COMMA_LIST_FIELDS.has(kvMatch[1])) {
        frontmatter[kvMatch[1]] = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        frontmatter[kvMatch[1]] = value;
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Extract all rune:<name> cross-references from body
 */
export function extractCrossRefs(body) {
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
export function extractToolRefs(body) {
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

  // Extract signals — emit/listen arrays from metadata or top-level (Pro/Business packs)
  const emit = Array.isArray(metadata.emit) ? metadata.emit : Array.isArray(frontmatter.emit) ? frontmatter.emit : [];
  const listen = Array.isArray(metadata.listen)
    ? metadata.listen
    : Array.isArray(frontmatter.listen)
      ? frontmatter.listen
      : [];
  const signals = emit.length > 0 || listen.length > 0 ? { emit, listen } : null;

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    layer: metadata.layer || 'L2',
    model: metadata.model || 'sonnet',
    group: metadata.group || 'general',
    signals,
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
 * Supports both monolith format (all skills inline) and split format (skills in separate files)
 *
 * Split format detection: metadata.format === "split" OR metadata.skills array present
 */
export function parsePack(content, filePath = '') {
  const { frontmatter, body } = parseFrontmatter(content);
  const metadata = frontmatter.metadata || {};

  // Detect split format
  const isSplit = metadata.format === 'split' || Array.isArray(metadata.skills);

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    version: metadata.version || frontmatter.version || '1.0.0',
    layer: 'L4',
    group: 'extension',
    isSplit,
    skillManifest: isSplit ? parseSkillManifest(metadata.skills || []) : [],
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
 * Parse the skills manifest from split PACK.md frontmatter
 *
 * @param {Array} skills - array of skill entries from frontmatter metadata.skills
 * @returns {Array<{name: string, file: string, model: string, description: string}>}
 */
/**
 * Parse a workflow template file (templates/*.md)
 *
 * Templates have the same frontmatter structure as skills but with additional
 * template-specific fields: domain, chain, connections[]
 *
 * @param {string} content - raw template file content
 * @param {string} [filePath] - optional file path for error reporting
 * @returns {ParsedTemplate}
 */
export function parseTemplate(content, filePath = '') {
  const { frontmatter, body } = parseFrontmatter(content);

  // Parse signals — can be nested object { emit: "...", listen: "..." } or flat
  const signalsRaw = frontmatter.signals || {};
  const emit =
    typeof signalsRaw.emit === 'string'
      ? signalsRaw.emit
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(signalsRaw.emit)
        ? signalsRaw.emit
        : [];
  const listen =
    typeof signalsRaw.listen === 'string'
      ? signalsRaw.listen
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(signalsRaw.listen)
        ? signalsRaw.listen
        : [];

  // Parse connections array — supports both comma-separated string and YAML array
  let connections = [];
  if (frontmatter.connections) {
    if (typeof frontmatter.connections === 'string') {
      connections = frontmatter.connections
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (Array.isArray(frontmatter.connections)) {
      connections = frontmatter.connections;
    }
  }

  return {
    name: frontmatter.name || '',
    pack: frontmatter.pack || '',
    version: frontmatter.version || '1.0.0',
    description: frontmatter.description || '',
    domain: frontmatter.domain || '',
    chain: frontmatter.chain || 'standard',
    signals: { emit, listen },
    connections,
    body,
    crossRefs: extractCrossRefs(body),
    sections: extractSections(body),
    filePath,
    frontmatter,
  };
}

/**
 * Parse organization config from .rune/org/org.md
 * Extracts teams, roles, policies, approval flows, and governance level.
 */
export function parseOrgConfig(content, filePath = '') {
  const { frontmatter, body } = parseFrontmatter(content);

  const teams = parseMarkdownTable(body, 'Teams');
  const roles = parseMarkdownTable(body, 'Roles');
  const policies = parseOrgPolicies(body);
  const approvalFlows = parseApprovalFlows(body);
  const governanceLevel = parseGovernanceLevel(body);

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    version: frontmatter.version || '1.0.0',
    tier: frontmatter.tier || 'business',
    teams,
    roles,
    policies,
    approvalFlows,
    governanceLevel,
    body,
    filePath,
    frontmatter,
  };
}

/**
 * Parse a Markdown table under a ## heading into array of objects.
 * Handles | col1 | col2 | format with header row + separator row + data rows.
 */
function parseMarkdownTable(body, sectionName) {
  // Find the section
  const sectionPattern = new RegExp(
    `## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  const sectionMatch = body.match(sectionPattern);
  if (!sectionMatch) return [];

  const sectionContent = sectionMatch[1];
  const lines = sectionContent
    .split('\n')
    .filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return []; // need header + separator + at least 1 row

  const parseRow = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_'),
  );
  // Skip separator row (lines[1])
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    if (cells.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Parse ### subsections under ## Policies into a map of policy name → rules array.
 */
function parseOrgPolicies(body) {
  const policiesPattern = /## Policies\s*\n([\s\S]*?)(?=\n## [^#]|$)/;
  const policiesMatch = body.match(policiesPattern);
  if (!policiesMatch) return {};

  // Prepend \n so first ### subsection is also captured by split
  const policiesContent = '\n' + policiesMatch[1].trimStart();
  const policies = {};
  const subSections = policiesContent.split(/\n### /);

  for (let i = 1; i < subSections.length; i++) {
    const lines = subSections[i].split('\n');
    const name = lines[0].trim().toLowerCase().replace(/\s+/g, '_');
    const rules = lines
      .slice(1)
      .filter((l) => l.trim().startsWith('- **'))
      .map((l) => {
        const match = l.match(/- \*\*(.+?)\*\*:\s*(.+)/);
        if (!match) return null;
        return {
          key: match[1].trim().toLowerCase().replace(/\s+/g, '_'),
          value: match[2].trim(),
        };
      })
      .filter(Boolean);
    policies[name] = rules;
  }
  return policies;
}

/**
 * Parse ### subsections under ## Approval Flows into named flow strings.
 */
function parseApprovalFlows(body) {
  const flowsPattern = /## Approval Flows\s*\n([\s\S]*?)(?=\n## [^#]|$)/;
  const flowsMatch = body.match(flowsPattern);
  if (!flowsMatch) return {};

  // Prepend \n so first ### subsection is also captured by split
  const flowsContent = '\n' + flowsMatch[1].trimStart();
  const flows = {};
  const subSections = flowsContent.split(/\n### /);

  for (let i = 1; i < subSections.length; i++) {
    const lines = subSections[i].split('\n');
    const name = lines[0].trim().toLowerCase().replace(/\s+/g, '_');
    // Extract content between ``` blocks
    const codeMatch = subSections[i].match(/```\n([\s\S]*?)```/);
    if (codeMatch) {
      flows[name] = codeMatch[1].trim();
    }
  }
  return flows;
}

/**
 * Parse ## Governance Level section for governance mode and settings.
 */
function parseGovernanceLevel(body) {
  const govPattern = /## Governance Level\s*\n([\s\S]*?)(?=\n## |$)/;
  const govMatch = body.match(govPattern);
  if (!govMatch) return { level: 'unknown', settings: [] };

  const content = govMatch[1];
  // Extract bold level: **Minimal**, **Moderate**, **Maximum**
  const levelMatch = content.match(/\*\*(\w+)\*\*/);
  const level = levelMatch ? levelMatch[1].toLowerCase() : 'unknown';

  // Extract bullet settings
  const settings = content
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => l.trim().replace(/^- /, ''));

  return { level, settings };
}

function parseSkillManifest(skills) {
  if (!Array.isArray(skills)) return [];

  return skills.map((skill) => {
    // Handle both string format ("skill-name") and object format ({name, file, model, description})
    if (typeof skill === 'string') {
      return {
        name: skill,
        file: `skills/${skill}.md`,
        model: 'sonnet',
        description: '',
      };
    }

    return {
      name: skill.name || '',
      file: skill.file || `skills/${skill.name}.md`,
      model: skill.model || 'sonnet',
      description: skill.description || '',
    };
  });
}
