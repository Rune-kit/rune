/**
 * Agent definitions in agents/*.md must stay in sync with the matching
 * skill's authoring tier and tool list, and may only use portable keys
 * Claude Code, Gemini CLI, Grok Build, and Cursor all accept.
 */
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { AUTHORING_TIERS } from '../adapters/model-tiers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const AGENTS = join(ROOT, 'agents');
const SKILLS = join(ROOT, 'skills');
const PORTABLE_KEYS = new Set(['name', 'description', 'model', 'tools']);
const KNOWN_TIERS = new Set([...AUTHORING_TIERS, 'inherit']);

function parseFrontmatter(block, { indent = 0 } = {}) {
  const prefix = ' '.repeat(indent);
  const out = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const hit = lines[i].match(new RegExp(`^${prefix}([A-Za-z0-9_-]+):\\s*(.*)$`));
    if (!hit) continue;
    const [, key, raw] = hit;
    if (raw === '' && lines[i + 1]?.startsWith(`${prefix}  - `)) {
      const items = [];
      while (lines[i + 1]?.startsWith(`${prefix}  - `)) {
        i += 1;
        items.push(lines[i].slice(prefix.length + 4).trim());
      }
      out[key] = items.join(', ');
    } else {
      out[key] = raw.trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? parseFrontmatter(match[1]) : {};
}

function skillMeta(name) {
  const file = join(SKILLS, name, 'SKILL.md');
  try {
    const text = readFileSync(file, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? parseFrontmatter(match[1], { indent: 2 }) : {};
  } catch {
    return null;
  }
}

const agentFiles = readdirSync(AGENTS).filter((f) => f.endsWith('.md'));

describe('agents/*.md frontmatter', () => {
  test('every agent uses a current authoring tier and a tools list', () => {
    assert.ok(agentFiles.length >= 60);
    for (const file of agentFiles) {
      const fm = frontmatter(readFileSync(join(AGENTS, file), 'utf8'));
      assert.ok(KNOWN_TIERS.has(fm.model), `${file}: unexpected model "${fm.model}"`);
      assert.ok(fm.tools, `${file}: missing tools`);
      assert.match(
        fm.tools,
        /^[A-Za-z][A-Za-z0-9_-]*(?:, [A-Za-z][A-Za-z0-9_-]*)*$/,
        `${file}: tools format (${fm.tools})`,
      );
    }
  });

  test('frontmatter keys stay in the portable set (Gemini rejects unknown keys)', () => {
    for (const file of agentFiles) {
      const text = readFileSync(join(AGENTS, file), 'utf8');
      const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
      for (const line of block.split(/\r?\n/)) {
        const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1];
        if (key) assert.ok(PORTABLE_KEYS.has(key), `${file}: non-portable key ${key}`);
      }
    }
  });

  test("matching skills share the agent's model tier and tools list", () => {
    let compared = 0;
    for (const file of agentFiles) {
      const name = file.replace(/\.md$/, '');
      const skill = skillMeta(name);
      if (!skill) continue; // standalone agents (coder, reviewer, …)
      const fm = frontmatter(readFileSync(join(AGENTS, file), 'utf8'));
      if (skill.model) {
        assert.strictEqual(fm.model, skill.model, `${file} model drifted from skills/${name}`);
        compared += 1;
      }
      if (skill.tools) {
        assert.strictEqual(fm.tools, skill.tools, `${file} tools drifted from skills/${name}`);
      }
    }
    assert.ok(compared >= 50, `expected to compare most agents, compared ${compared}`);
  });
});
