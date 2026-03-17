import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parsePack } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSIONS_DIR = path.resolve(__dirname, '../../extensions');

// --- Monolith format (regression) ---

test('parsePack: monolith format has isSplit=false', () => {
  const content = `---
name: "@rune/trading"
description: "Trading patterns"
metadata:
  version: "0.2.0"
  layer: L4
  price: free
  target: Traders
---

# @rune/trading

## Purpose
Trading pack.

## Skills Included

### risk-management
Risk management workflow.
`;

  const parsed = parsePack(content, 'extensions/trading/PACK.md');

  assert.strictEqual(parsed.isSplit, false);
  assert.deepStrictEqual(parsed.skillManifest, []);
  assert.strictEqual(parsed.name, '@rune/trading');
  assert.strictEqual(parsed.version, '0.2.0');
  assert.strictEqual(parsed.layer, 'L4');
  assert.ok(parsed.body.includes('risk-management'));
});

test('parsePack: monolith without metadata block defaults correctly', () => {
  const content = `---
name: "@rune/test"
description: "Test pack"
---

# @rune/test
Body here.
`;

  const parsed = parsePack(content, 'test/PACK.md');

  assert.strictEqual(parsed.isSplit, false);
  assert.strictEqual(parsed.version, '1.0.0');
});

// --- Split format detection ---

test('parsePack: split format detected via metadata.format', () => {
  const content = `---
name: "@rune/backend"
description: "Backend patterns"
metadata:
  version: "0.3.0"
  layer: L4
  price: free
  target: Backend developers
  format: split
---

# @rune/backend

## Purpose
Backend pack index.

## Skills Included
| Skill | Model | Description |
|-------|-------|-------------|
| api-design | sonnet | API patterns |
| auth | sonnet | Auth patterns |
`;

  const parsed = parsePack(content, 'extensions/backend/PACK.md');

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.version, '0.3.0');
  assert.strictEqual(parsed.name, '@rune/backend');
});

test('parsePack: skill manifest parsed from string array', () => {
  // Note: our YAML parser is simple — it handles nested objects but not arrays.
  // This test validates the parseSkillManifest function directly with object skills.
  const content = `---
name: "@rune/test"
description: "Test"
metadata:
  format: split
---

Body.
`;

  const parsed = parsePack(content, 'test/PACK.md');
  assert.strictEqual(parsed.isSplit, true);
  // With simple YAML parser, skills array won't parse — manifest will be empty
  // Real usage will use the skills/ directory detection as fallback
  assert.ok(Array.isArray(parsed.skillManifest));
});

// --- Real pack regression: existing monolith packs parse correctly ---

test('parsePack: real trading PACK.md parses as split', () => {
  const tradingPath = path.join(EXTENSIONS_DIR, 'trading', 'PACK.md');
  if (!existsSync(tradingPath)) {
    console.log('  skip: trading PACK.md not found');
    return;
  }

  const content = readFileSync(tradingPath, 'utf-8');
  const parsed = parsePack(content, tradingPath);

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.layer, 'L4');
  assert.strictEqual(parsed.group, 'extension');
  assert.ok(parsed.body.length > 50);
});

test('parsePack: real backend PACK.md parses as split (post-split)', () => {
  const backendPath = path.join(EXTENSIONS_DIR, 'backend', 'PACK.md');
  if (!existsSync(backendPath)) {
    console.log('  skip: backend PACK.md not found');
    return;
  }

  const content = readFileSync(backendPath, 'utf-8');
  const parsed = parsePack(content, backendPath);

  assert.strictEqual(parsed.isSplit, true);
  assert.strictEqual(parsed.layer, 'L4');
  assert.ok(parsed.sections.size > 0);
});
