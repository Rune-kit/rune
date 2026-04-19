import assert from 'node:assert';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  findMatchingInvariants,
  loadInvariants,
  matchesInvariant,
  parseInvariants,
  renderPreview,
  stripArchived,
} from '../../skills/session-bridge/scripts/load-invariants.js';

const SAMPLE = `# Project Invariants

## Auto-detected (new)

### Danger Zones

#### skill-router
- **WHAT**: L0 router — every action must route through this
- **WHERE**: \`skills/skill-router/**\`
- **WHY**: bypass = architectural rot

#### cook
- **WHAT**: L1 orchestrator, 70% of tasks
- **WHERE**: \`skills/cook/**\`
- **WHY**: breaking cook breaks the mesh

### Critical Invariants

#### parser-IR-schema
- **WHAT**: IR shape is the contract across all adapters
- **WHERE**: \`compiler/parser.js\`, \`compiler/adapters/**\`
- **WHY**: schema drift silently miscompiles every pack

### State Machine Rules

#### hook-dispatch-phases
- **WHAT**: phases fire in order pre → run → post
- **WHERE**: \`compiler/hooks/dispatch.js\`
- **WHY**: reordering breaks PostToolUse invariant

### Cross-File Consistency

#### pack-manifest-tuple
- **WHAT**: pack names mirror between marketplace.json + plugin.json
- **WHERE**: \`.claude-plugin/marketplace.json\`, \`.claude-plugin/plugin.json\`
- **WHY**: drift breaks install

## Archived

### Danger Zones

#### legacy-emitter
- **WHAT**: old monolith emitter (retired 2026-01)
- **WHERE**: \`compiler/legacy/**\`
- **WHY**: kept for reference only — do not reactivate
`;

describe('stripArchived', () => {
  test('removes the Archived section and everything below', () => {
    const out = stripArchived(SAMPLE);
    assert.ok(!out.includes('legacy-emitter'), 'archived rule body removed');
    assert.ok(!out.includes('## Archived'), 'archived heading removed');
    assert.ok(out.includes('skill-router'), 'active rules preserved');
  });

  test('is a no-op when no Archived section present', () => {
    const text = '# X\n\n## Auto-detected (new)\n\n#### rule\n';
    assert.strictEqual(stripArchived(text), text);
  });
});

describe('parseInvariants', () => {
  test('extracts rules with section + what/where/why', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    assert.strictEqual(rules.length, 5);

    const router = rules.find((r) => r.title === 'skill-router');
    assert.ok(router, 'skill-router rule parsed');
    assert.strictEqual(router.section, 'danger');
    assert.match(router.what, /L0 router/);
    assert.deepStrictEqual(router.where, ['skills/skill-router/**']);
    assert.match(router.why, /architectural rot/);
  });

  test('multi-glob WHERE splits on backticks', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    const parser = rules.find((r) => r.title === 'parser-IR-schema');
    assert.deepStrictEqual(parser.where, ['compiler/parser.js', 'compiler/adapters/**']);
  });

  test('ignores archived rules (pre-stripped)', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    assert.ok(!rules.some((r) => r.title === 'legacy-emitter'));
  });

  test('tolerates missing WHAT/WHERE/WHY fields', () => {
    const text = '## Danger Zones\n\n#### partial\n- **WHAT**: only what\n';
    const rules = parseInvariants(text);
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].why, '');
    assert.deepStrictEqual(rules[0].where, []);
  });

  test('returns empty array for empty / malformed input', () => {
    assert.deepStrictEqual(parseInvariants(''), []);
    assert.deepStrictEqual(parseInvariants('just some prose with no headers'), []);
  });
});

describe('renderPreview', () => {
  test('orders rules by priority (danger → critical → state → cross)', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    const { preview } = renderPreview(rules, { budgetTokens: 500 });
    const dangerIdx = preview.indexOf('skills/skill-router/**');
    const criticalIdx = preview.indexOf('compiler/parser.js');
    const stateIdx = preview.indexOf('compiler/hooks/dispatch.js');
    const crossIdx = preview.indexOf('marketplace.json');
    assert.ok(dangerIdx > 0 && dangerIdx < criticalIdx, 'danger before critical');
    assert.ok(criticalIdx < stateIdx, 'critical before state');
    assert.ok(stateIdx < crossIdx, 'state before cross');
  });

  test('includes section icons', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    const { preview } = renderPreview(rules, { budgetTokens: 500 });
    assert.match(preview, /⚠/);
    assert.match(preview, /🔒/);
    assert.match(preview, /🔁/);
    assert.match(preview, /🔗/);
  });

  test('caps output at budget and reports overflow', () => {
    const rules = parseInvariants(stripArchived(SAMPLE));
    const { preview, overflow } = renderPreview(rules, { budgetTokens: 30 });
    assert.ok(overflow >= 1, 'overflow reported when budget exhausted');
    assert.match(preview, /\+\d+ more rule/);
  });

  test('empty rules → empty preview, zero overflow', () => {
    const { preview, overflow } = renderPreview([], { budgetTokens: 500 });
    assert.strictEqual(preview, '');
    assert.strictEqual(overflow, 0);
  });
});

describe('loadInvariants — end-to-end', () => {
  test('silent no-op when .rune/INVARIANTS.md is missing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-missing-'));
    try {
      const result = await loadInvariants({ root });
      assert.strictEqual(result.loaded, false);
      assert.strictEqual(result.rules.length, 0);
      assert.strictEqual(result.preview, '');
      assert.strictEqual(result.stale, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('loads + parses + renders when file present', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      await writeFile(path.join(root, '.rune', 'INVARIANTS.md'), SAMPLE, 'utf8');

      const result = await loadInvariants({ root });
      assert.strictEqual(result.loaded, true);
      assert.strictEqual(result.stats.total, 5);
      assert.strictEqual(result.stats.danger, 2);
      assert.strictEqual(result.stats.critical, 1);
      assert.strictEqual(result.stats.state, 1);
      assert.strictEqual(result.stats.cross, 1);
      assert.ok(result.stats.archivedSkipped, 'archived section noted as stripped');
      assert.match(result.preview, /Active Invariants/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('flags staleness when mtime older than 30 days', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-stale-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      const file = path.join(root, '.rune', 'INVARIANTS.md');
      await writeFile(file, SAMPLE, 'utf8');
      const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      await utimes(file, old, old);

      const result = await loadInvariants({ root });
      assert.strictEqual(result.stale, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fresh file is not flagged stale', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-fresh-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      await writeFile(path.join(root, '.rune', 'INVARIANTS.md'), SAMPLE, 'utf8');
      const result = await loadInvariants({ root });
      assert.strictEqual(result.stale, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('malformed file → loaded:false, zero rules, does not throw', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-bad-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      await writeFile(path.join(root, '.rune', 'INVARIANTS.md'), 'not markdown in any structured sense', 'utf8');
      const result = await loadInvariants({ root });
      assert.strictEqual(result.loaded, false);
      assert.strictEqual(result.rules.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('throws if root is not provided', async () => {
    await assert.rejects(() => loadInvariants({}), /root is required/);
  });

  test('signal contract: returns documented payload shape', async () => {
    // Locks F1: session-bridge docs promise `{ loaded, count, rules, stats,
    // stale, overflow, path }` — consumers in logic-guardian + autopilot
    // depend on every field. Any drift must break this test.
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-contract-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      await writeFile(path.join(root, '.rune', 'INVARIANTS.md'), SAMPLE, 'utf8');
      const result = await loadInvariants({ root });
      assert.deepStrictEqual(Object.keys(result).sort(), [
        'count',
        'loaded',
        'overflow',
        'path',
        'preview',
        'rules',
        'stale',
        'stats',
      ]);
      assert.strictEqual(typeof result.loaded, 'boolean');
      assert.strictEqual(typeof result.count, 'number');
      assert.strictEqual(result.count, result.rules.length);
      assert.strictEqual(result.count, result.stats.total);
      assert.ok(Array.isArray(result.rules));
      const sample = result.rules[0];
      assert.deepStrictEqual(Object.keys(sample).sort(), ['section', 'title', 'what', 'where', 'why']);
      assert.ok(Array.isArray(sample.where));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('archived-only file → loaded:false, archivedSkipped:true', async () => {
    // F7 edge case: a file that contains ONLY archived rules. loaded must be
    // false (no active rules), but archivedSkipped must be true so callers can
    // distinguish "file absent" from "all rules retired".
    const root = await mkdtemp(path.join(tmpdir(), 'rune-load-inv-archived-'));
    try {
      await mkdir(path.join(root, '.rune'), { recursive: true });
      const archivedOnly = [
        '# Project Invariants',
        '',
        '## Archived',
        '',
        '### Danger Zones',
        '',
        '#### retired-rule',
        '- **WHAT**: no longer relevant',
        '- **WHERE**: `legacy/**`',
        '- **WHY**: retired 2026-01',
        '',
      ].join('\n');
      await writeFile(path.join(root, '.rune', 'INVARIANTS.md'), archivedOnly, 'utf8');
      const result = await loadInvariants({ root });
      assert.strictEqual(result.loaded, false);
      assert.strictEqual(result.count, 0);
      assert.strictEqual(result.stats.archivedSkipped, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('stripArchived — fence-aware (F4)', () => {
  test('`## Archived` inside a fenced code block does NOT terminate active rules', () => {
    const text = [
      '# X',
      '',
      '## Danger Zones',
      '',
      '#### real-rule',
      '- **WHAT**: stay',
      '- **WHERE**: `src/**`',
      '- **WHY**: keep me',
      '',
      '```markdown',
      '## Archived',
      'this is an example not a real section',
      '```',
      '',
      '#### another-real-rule',
      '- **WHAT**: also stay',
      '',
    ].join('\n');
    const stripped = stripArchived(text);
    assert.ok(stripped.includes('real-rule'));
    assert.ok(stripped.includes('another-real-rule'), 'rule after the fenced example must survive');
    assert.ok(stripped.includes('this is an example'), 'fence body preserved');
  });

  test('real `## Archived` after a fence still terminates', () => {
    const text = [
      '## Danger Zones',
      '#### r1',
      '- **WHAT**: x',
      '```',
      '## Archived  // fake',
      '```',
      '## Archived',
      '#### old',
      '- **WHAT**: retired',
      '',
    ].join('\n');
    const stripped = stripArchived(text);
    assert.ok(stripped.includes('r1'));
    assert.ok(!stripped.includes('#### old'), 'real archived section terminates');
  });
});

describe('parseInvariants — fence-aware (F3)', () => {
  test('`#### fake` inside a fenced code block does NOT create a phantom rule', () => {
    const text = [
      '## Danger Zones',
      '',
      '#### real-rule',
      '- **WHAT**: the WHY demos markdown:',
      '- **WHERE**: `src/**`',
      '- **WHY**: see example below',
      '',
      '```markdown',
      '#### fake-rule-in-example',
      '- **WHAT**: this is documentation',
      '```',
      '',
      '#### second-real-rule',
      '- **WHAT**: after the fence',
      '',
    ].join('\n');
    const rules = parseInvariants(text);
    const titles = rules.map((r) => r.title);
    assert.deepStrictEqual(titles, ['real-rule', 'second-real-rule']);
    assert.ok(!titles.includes('fake-rule-in-example'));
  });
});

describe('matchesInvariant / findMatchingInvariants (F5)', () => {
  const rules = [
    { section: 'danger', title: 'router', what: '', where: ['skills/skill-router/**'], why: '' },
    { section: 'critical', title: 'parser', what: '', where: ['compiler/parser.js', 'compiler/adapters/**'], why: '' },
    { section: 'cross', title: 'no-where', what: '', where: [], why: '' },
  ];

  test('matches ** recursive glob', () => {
    assert.ok(matchesInvariant('skills/skill-router/foo.js', rules[0]));
    assert.ok(matchesInvariant('skills/skill-router/nested/deep/file.ts', rules[0]));
    assert.ok(!matchesInvariant('skills/cook/foo.js', rules[0]));
  });

  test('matches literal file path', () => {
    assert.ok(matchesInvariant('compiler/parser.js', rules[1]));
    assert.ok(!matchesInvariant('compiler/parser.ts', rules[1]));
  });

  test('matches multi-glob where[] (any-of semantics)', () => {
    assert.ok(matchesInvariant('compiler/adapters/claude.js', rules[1]));
  });

  test('normalizes Windows backslashes before matching', () => {
    assert.ok(matchesInvariant('skills\\skill-router\\foo.js', rules[0]));
  });

  test('strips leading ./ before matching', () => {
    assert.ok(matchesInvariant('./compiler/parser.js', rules[1]));
  });

  test('empty where[] never matches', () => {
    assert.ok(!matchesInvariant('anything.js', rules[2]));
  });

  test('findMatchingInvariants returns all hits in order', () => {
    const hits = findMatchingInvariants('compiler/adapters/claude.js', rules);
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].title, 'parser');
  });

  test('findMatchingInvariants returns empty when nothing matches', () => {
    const hits = findMatchingInvariants('docs/README.md', rules);
    assert.deepStrictEqual(hits, []);
  });
});
