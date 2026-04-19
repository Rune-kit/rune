import assert from 'node:assert';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  collectPointerGlobs,
  loadTemplate,
  mergeInvariantsContent,
  runOnboardInvariants,
} from '../../skills/onboard/scripts/onboard-invariants.js';

describe('mergeInvariantsContent', () => {
  test('seeds from template when existing is empty', () => {
    const template = '# Project Invariants\n\n## Auto-detected (new)\n\n<!-- placeholder -->\n';
    const detected = {
      danger: [{ title: 'core', what: '10 files', where: ['src/core/**'], why: 'hub' }],
      critical: [],
      state: [],
      cross: [],
    };
    const merged = mergeInvariantsContent({ existing: '', autoDetected: detected, template });
    assert.ok(merged.seeded);
    assert.ok(merged.content.includes('# Project Invariants'));
    assert.ok(merged.content.includes('#### core'));
  });

  test('replaces ONLY the auto-detected block on re-run', () => {
    const first = mergeInvariantsContent({
      existing: '',
      autoDetected: {
        danger: [{ title: 'v1', what: 'old', where: ['src/v1/**'], why: 'first' }],
        critical: [],
        state: [],
        cross: [],
      },
      template: '# Project Invariants\n\n## Auto-detected (new)\n\n<!-- placeholder -->\n',
    });

    const userEdited = first.content.replace(
      '# Project Invariants',
      '# Project Invariants\n\n## Danger Zones\n\n#### UserRule\n- **WHAT**: custom\n- **WHERE**: `src/custom/**`\n- **WHY**: user-added\n',
    );

    const second = mergeInvariantsContent({
      existing: userEdited,
      autoDetected: {
        danger: [{ title: 'v2', what: 'new', where: ['src/v2/**'], why: 'second' }],
        critical: [],
        state: [],
        cross: [],
      },
      template: '',
    });

    assert.ok(second.replaced);
    assert.ok(second.content.includes('UserRule'), 'user edits must be preserved');
    assert.ok(second.content.includes('#### v2'), 'new detection must appear');
    assert.ok(!second.content.includes('#### v1'), 'old detection must be replaced');
  });

  test('appends Auto-detected header if missing from existing file', () => {
    const existing = '# Project Invariants\n\n## Danger Zones\n\n#### legacy\n';
    const merged = mergeInvariantsContent({
      existing,
      autoDetected: {
        danger: [{ title: 'fresh', what: 'n', where: ['src/x/**'], why: 'y' }],
        critical: [],
        state: [],
        cross: [],
      },
      template: '',
    });
    assert.ok(merged.appended);
    assert.ok(merged.content.includes('## Auto-detected (new)'));
    assert.ok(merged.content.includes('legacy'), 'existing user content preserved');
  });

  test('renders placeholder line when no detections', () => {
    const merged = mergeInvariantsContent({
      existing: '',
      autoDetected: { danger: [], critical: [], state: [], cross: [] },
      template: '# X\n\n## Auto-detected (new)\n\n<!-- placeholder -->\n',
    });
    assert.match(merged.content, /No new detections on this run/);
  });

  test('Phase 2 C1: code-fence with `## ` inside auto-detected block does not corrupt merge', () => {
    // User manually edits the file and embeds a markdown example showing a `## `
    // line inside a fenced code block (e.g. illustrating markdown syntax).
    // The old regex-based boundary scan would treat that `## ` as a real section
    // header and drop everything after it. This test locks in the line-walking
    // fence-aware boundary detection.
    const existing = [
      '# Project Invariants',
      '',
      '## Danger Zones',
      '',
      '#### PreservedRule',
      '- **WHAT**: do not touch',
      '',
      '## Auto-detected (new)',
      '',
      '```markdown',
      '## This heading is inside a fence',
      'example content',
      '```',
      '',
      '#### OldDetection',
      '',
      '## Notes (user section)',
      '',
      'should survive too',
      '',
    ].join('\n');

    const merged = mergeInvariantsContent({
      existing,
      autoDetected: {
        danger: [{ title: 'NewDetection', what: 'fresh', where: ['src/fresh/**'], why: 'new' }],
        critical: [],
        state: [],
        cross: [],
      },
      template: '',
    });

    assert.ok(merged.replaced);
    assert.ok(merged.content.includes('PreservedRule'), 'content above Auto-detected preserved');
    assert.ok(merged.content.includes('NewDetection'), 'new detection inserted');
    assert.ok(!merged.content.includes('OldDetection'), 'old auto-detected content replaced');
    assert.ok(merged.content.includes('Notes (user section)'), 'real `## ` section after block survives');
    assert.ok(merged.content.includes('should survive too'), 'body of real section survives');
  });
});

describe('collectPointerGlobs', () => {
  test('extracts and dedupes globs from danger + critical buckets', () => {
    const globs = collectPointerGlobs({
      danger: [{ where: ['src/a/**'] }, { where: ['src/b/**'] }, { where: ['src/a/**'] }],
      critical: [{ where: ['src/b/**'] }, { where: ['src/c/**'] }],
      state: [],
      cross: [],
    });
    assert.deepStrictEqual(globs.sort(), ['src/a/**', 'src/b/**', 'src/c/**']);
  });
});

describe('loadTemplate', () => {
  test('reads the bundled template file', async () => {
    const content = await loadTemplate();
    assert.ok(content.includes('Project Invariants'));
    assert.ok(content.includes('Auto-detected (new)'));
  });
});

describe('runOnboardInvariants — end-to-end', () => {
  test('seeds INVARIANTS.md and injects CLAUDE.md pointer', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-onboard-'));
    try {
      await mkdir(path.join(root, 'src', 'core'), { recursive: true });
      for (let i = 0; i < 12; i++) {
        await writeFile(path.join(root, 'src', 'core', `file${i}.ts`), `export const X${i} = ${i};\n`, 'utf8');
      }
      await writeFile(path.join(root, 'CLAUDE.md'), '# Fresh Project\n', 'utf8');

      const result = await runOnboardInvariants({ root });

      assert.strictEqual(result.invariants.action, 'seeded');
      assert.ok(['created', 'updated'].includes(result.claudeMd.action));

      const invariants = await readFile(path.join(root, '.rune', 'INVARIANTS.md'), 'utf8');
      assert.ok(invariants.includes('Project Invariants'));

      const claudeMd = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
      assert.ok(claudeMd.includes('@rune-invariants-pointer:start'));
      assert.ok(claudeMd.includes('.rune/INVARIANTS.md'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('Phase 2 H1: SKILL.md / PACK.md directories surface as danger zones', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-onboard-skills-'));
    try {
      // Seed an AI-skills-repo shape: directories containing SKILL.md but no
      // SOURCE_EXTS files. Old detector (exts-only scan) missed these entirely.
      await mkdir(path.join(root, 'skills', 'skill-router'), { recursive: true });
      await mkdir(path.join(root, 'skills', 'cook'), { recursive: true });
      await mkdir(path.join(root, 'extensions', 'ui'), { recursive: true });
      await writeFile(path.join(root, 'skills', 'skill-router', 'SKILL.md'), '# Router\n', 'utf8');
      await writeFile(path.join(root, 'skills', 'cook', 'SKILL.md'), '# Cook\n', 'utf8');
      await writeFile(path.join(root, 'extensions', 'ui', 'PACK.md'), '# UI Pack\n', 'utf8');
      await writeFile(path.join(root, 'CLAUDE.md'), '# P\n', 'utf8');

      const result = await runOnboardInvariants({ root });
      assert.strictEqual(result.invariants.action, 'seeded');

      const invariants = await readFile(path.join(root, '.rune', 'INVARIANTS.md'), 'utf8');
      const hasSkillRouter = invariants.includes('skills/skill-router');
      const hasCook = invariants.includes('skills/cook');
      const hasUiPack = invariants.includes('extensions/ui');
      assert.ok(
        hasSkillRouter || hasCook || hasUiPack,
        'at least one signal-file directory must surface as a danger zone',
      );
      assert.ok(invariants.includes('skill/pack artifact') || invariants.includes('High-risk keyword'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('second run preserves user edits above Auto-detected', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rune-onboard-'));
    try {
      await mkdir(path.join(root, 'src', 'core'), { recursive: true });
      for (let i = 0; i < 10; i++) {
        await writeFile(path.join(root, 'src', 'core', `f${i}.ts`), `export const Y${i} = ${i};\n`, 'utf8');
      }
      await writeFile(path.join(root, 'CLAUDE.md'), '# P\n', 'utf8');

      await runOnboardInvariants({ root });

      const invariantsPath = path.join(root, '.rune', 'INVARIANTS.md');
      const original = await readFile(invariantsPath, 'utf8');
      const edited = original.replace(
        '## Auto-detected (new)',
        '## Danger Zones\n\n#### UserRule\n- **WHAT**: sacred\n- **WHERE**: `src/sacred/**`\n- **WHY**: must-not-touch\n\n## Auto-detected (new)',
      );
      await writeFile(invariantsPath, edited, 'utf8');

      await runOnboardInvariants({ root });
      const after = await readFile(invariantsPath, 'utf8');
      assert.ok(after.includes('UserRule'), 'user section must survive re-run');
      assert.ok(after.includes('## Auto-detected (new)'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
