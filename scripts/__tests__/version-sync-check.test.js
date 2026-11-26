import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const SCRIPT = join(ROOT, 'scripts/version-sync-check.js');

describe('version-sync-check', () => {
  test('runs without crashing', () => {
    // This script checks real files — it may warn about npm registry but should not crash
    try {
      const output = execSync(`node "${SCRIPT}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.ok(output.includes('Version Sync Check'), 'Should print header');
    } catch (e) {
      // Exit code 1 means validation errors (expected if versions are out of sync)
      // But the script itself should not throw
      assert.ok(
        e.stdout.includes('Version Sync Check') || e.stderr.includes('Version Sync Check'),
        'Script crashed instead of reporting issues',
      );
    }
  });

  test('checks package.json vs plugin.json version', () => {
    try {
      const output = execSync(`node "${SCRIPT}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Should mention version check result
      assert.ok(
        output.includes('Version consistent') || output.includes('Version mismatch'),
        'Should report version comparison result',
      );
    } catch (e) {
      const combined = (e.stdout || '') + (e.stderr || '');
      assert.ok(
        combined.includes('Version consistent') || combined.includes('Version mismatch'),
        'Should report version comparison result even on failure',
      );
    }
  });

  test('checks extension packs on disk', () => {
    try {
      const output = execSync(`node "${SCRIPT}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.ok(
        output.includes('extension packs have PACK.md') || output.includes('Extension dirs without PACK.md'),
        'Should validate extension packs',
      );
    } catch (e) {
      const combined = (e.stdout || '') + (e.stderr || '');
      assert.ok(
        combined.includes('extension packs') || combined.includes('Extension dirs'),
        'Should validate extension packs even on failure',
      );
    }
  });

  test('fails the publish dry-run if npm would auto-correct or drop the rune bin', () => {
    let combined = '';
    try {
      combined = execSync(`node "${SCRIPT}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      combined = (e.stdout || '') + (e.stderr || '');
    }
    assert.ok(
      combined.includes('npm publish --dry-run: no auto-corrections; bin.rune is present') ||
        combined.includes('auto-corrected package.json') ||
        combined.includes('missing bin.rune') ||
        combined.includes('omit the ./ prefix'),
      'Should run an npm publish dry-run and report bin / auto-correction status',
    );
    assert.ok(
      !combined.includes('auto-corrected package.json') &&
        !combined.includes('omit the ./ prefix') &&
        !combined.includes('missing bin.rune'),
      combined,
    );
  });
});
