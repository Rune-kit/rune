import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, '../../skills');
const PRO_DIR = path.resolve(__dirname, '../../../Pro/extensions');
const BUSINESS_DIR = path.resolve(__dirname, '../../../Business/extensions');

// Collect known Free core skill names
const knownSkills = new Set();
if (existsSync(SKILLS_DIR)) {
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(SKILLS_DIR, entry.name, 'SKILL.md'))) {
      knownSkills.add(entry.name);
    }
  }
}

describe('inject.json format validation', () => {
  const packDirs = [];

  // Collect all extension dirs that might have inject.json
  for (const extDir of [PRO_DIR, BUSINESS_DIR]) {
    if (!existsSync(extDir)) continue;
    for (const entry of readdirSync(extDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const injectPath = path.join(extDir, entry.name, 'inject.json');
      if (existsSync(injectPath)) {
        packDirs.push({ name: entry.name, dir: path.join(extDir, entry.name), injectPath });
      }
    }
  }

  test('at least one inject.json exists in Pro packs', () => {
    assert.ok(packDirs.length > 0, 'Expected at least one pack with inject.json');
  });

  for (const pack of packDirs) {
    describe(`${pack.name}/inject.json`, () => {
      let config;

      test('is valid JSON', () => {
        const raw = readFileSync(pack.injectPath, 'utf-8');
        config = JSON.parse(raw);
        assert.ok(config, 'inject.json should parse as valid JSON');
      });

      test('has injections array', () => {
        if (!config) return;
        assert.ok(Array.isArray(config.injections), 'must have injections array');
        assert.ok(config.injections.length > 0, 'must have at least one injection rule');
      });

      test('has description field', () => {
        if (!config) return;
        assert.ok(config.description, 'should have a description field');
      });

      test('each rule has required fields', () => {
        if (!config) return;
        for (const rule of config.injections) {
          assert.ok(rule.skill, `rule must have "skill" field: ${JSON.stringify(rule)}`);
          assert.ok(rule.ref, `rule must have "ref" field: ${JSON.stringify(rule)}`);
          assert.ok(rule.context, `rule must have "context" field: ${JSON.stringify(rule)}`);
        }
      });

      test('target skills exist in Free core', () => {
        if (!config) return;
        for (const rule of config.injections) {
          assert.ok(
            knownSkills.has(rule.skill),
            `target skill "${rule.skill}" not found in Free core skills`,
          );
        }
      });

      test('reference files exist', () => {
        if (!config) return;
        for (const rule of config.injections) {
          const refPath = path.join(pack.dir, rule.ref);
          assert.ok(existsSync(refPath), `reference file "${rule.ref}" not found at ${refPath}`);
        }
      });

      test('reference files are .md', () => {
        if (!config) return;
        for (const rule of config.injections) {
          assert.ok(rule.ref.endsWith('.md'), `reference "${rule.ref}" should be a .md file`);
        }
      });

      test('no duplicate skill targets within same pack', () => {
        if (!config) return;
        const seen = new Set();
        for (const rule of config.injections) {
          assert.ok(!seen.has(rule.skill), `duplicate injection target "${rule.skill}" in ${pack.name}`);
          seen.add(rule.skill);
        }
      });
    });
  }
});

describe('injection rule coverage', () => {
  const expectedPacks = ['pro-product', 'pro-data-science', 'pro-sales', 'pro-support'];

  for (const packName of expectedPacks) {
    test(`${packName} has inject.json`, () => {
      const injectPath = path.join(PRO_DIR, packName, 'inject.json');
      assert.ok(existsSync(injectPath), `${packName} should have inject.json`);
    });
  }

  test('total injection rules across all packs', () => {
    let totalRules = 0;
    for (const packName of expectedPacks) {
      const injectPath = path.join(PRO_DIR, packName, 'inject.json');
      if (!existsSync(injectPath)) continue;
      const config = JSON.parse(readFileSync(injectPath, 'utf-8'));
      totalRules += (config.injections || []).length;
    }
    assert.ok(totalRules >= 8, `should have at least 8 injection rules total, got ${totalRules}`);
  });
});
