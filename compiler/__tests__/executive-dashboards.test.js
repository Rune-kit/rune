import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUSINESS_DIR = path.resolve(__dirname, '../../../Business');
const REPORT_TEMPLATES_DIR = path.join(BUSINESS_DIR, 'report-templates');
const SKILLS_DIR = path.resolve(__dirname, '../../skills');

// ─── HTML report template validation ──────────────────────────────

describe('Business report-templates directory', () => {
  test('report-templates directory exists', () => {
    assert.ok(existsSync(REPORT_TEMPLATES_DIR), 'Expected Business/report-templates/ to exist');
  });

  test('retro-business.html exists', () => {
    assert.ok(
      existsSync(path.join(REPORT_TEMPLATES_DIR, 'retro-business.html')),
      'Expected retro-business.html template',
    );
  });

  test('autopsy-executive.html exists', () => {
    assert.ok(
      existsSync(path.join(REPORT_TEMPLATES_DIR, 'autopsy-executive.html')),
      'Expected autopsy-executive.html template',
    );
  });
});

describe('retro-business.html template', () => {
  const filePath = path.join(REPORT_TEMPLATES_DIR, 'retro-business.html');
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');

  test('is valid HTML with doctype', () => {
    assert.ok(content.startsWith('<!DOCTYPE html>'), 'Must start with DOCTYPE');
    assert.ok(content.includes('<html'), 'Must have html tag');
    assert.ok(content.includes('</html>'), 'Must close html tag');
  });

  test('is self-contained (no external CSS/JS)', () => {
    assert.ok(!content.includes('href="http'), 'No external CSS links');
    assert.ok(!content.includes('src="http'), 'No external JS scripts');
    assert.ok(!content.includes('cdn.'), 'No CDN references');
  });

  test('has inline styles', () => {
    assert.ok(content.includes('<style>'), 'Must have inline style block');
  });

  test('has print-friendly styles', () => {
    assert.ok(content.includes('@media print'), 'Must have print media query');
    assert.ok(content.includes('@page'), 'Must have @page rule for PDF export');
  });

  test('has KPI card placeholders', () => {
    assert.ok(content.includes('{{sprint_velocity}}'), 'Missing sprint_velocity placeholder');
    assert.ok(content.includes('{{mrr}}'), 'Missing MRR placeholder');
    assert.ok(content.includes('{{sla_pct}}'), 'Missing SLA placeholder');
    assert.ok(content.includes('{{compliance_score}}'), 'Missing compliance_score placeholder');
  });

  test('has domain performance sections', () => {
    assert.ok(content.includes('Engineering'), 'Missing Engineering domain');
    assert.ok(content.includes('Revenue'), 'Missing Revenue domain');
    assert.ok(content.includes('Support'), 'Missing Support domain');
    assert.ok(content.includes('Finance'), 'Missing Finance domain');
  });

  test('has team health table', () => {
    assert.ok(content.includes('Team Health'), 'Missing Team Health section');
    assert.ok(content.includes('{{team_name}}'), 'Missing team_name placeholder');
    assert.ok(content.includes('{{team_lead}}'), 'Missing team_lead placeholder');
  });

  test('has compliance status section', () => {
    assert.ok(content.includes('Compliance Status'), 'Missing Compliance Status section');
    assert.ok(content.includes('{{framework}}'), 'Missing framework placeholder');
  });

  test('has key insights section (wins + risks)', () => {
    assert.ok(content.includes('Key Insights'), 'Missing Key Insights section');
    assert.ok(content.includes('Wins'), 'Missing Wins subsection');
    assert.ok(content.includes('Risks'), 'Missing Risks subsection');
  });

  test('has Rune Business footer', () => {
    assert.ok(content.includes('Rune Business'), 'Missing Rune Business branding');
    assert.ok(content.includes('retro --business'), 'Missing retro --business reference');
  });

  test('has trend delta placeholders for KPIs', () => {
    assert.ok(content.includes('{{velocity_delta}}'), 'Missing velocity trend');
    assert.ok(content.includes('{{mrr_delta}}'), 'Missing MRR trend');
  });

  test('uses CSS custom properties for theming', () => {
    assert.ok(content.includes(':root'), 'Must use CSS custom properties');
    assert.ok(content.includes('--bg'), 'Missing --bg variable');
    assert.ok(content.includes('--accent'), 'Missing --accent variable');
  });
});

describe('autopsy-executive.html template', () => {
  const filePath = path.join(REPORT_TEMPLATES_DIR, 'autopsy-executive.html');
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');

  test('is valid HTML with doctype', () => {
    assert.ok(content.startsWith('<!DOCTYPE html>'), 'Must start with DOCTYPE');
    assert.ok(content.includes('<html'), 'Must have html tag');
    assert.ok(content.includes('</html>'), 'Must close html tag');
  });

  test('is self-contained (no external CSS/JS)', () => {
    assert.ok(!content.includes('href="http'), 'No external CSS links');
    assert.ok(!content.includes('src="http'), 'No external JS scripts');
    assert.ok(!content.includes('cdn.'), 'No CDN references');
  });

  test('has print-friendly styles', () => {
    assert.ok(content.includes('@media print'), 'Must have print media query');
    assert.ok(content.includes('@page'), 'Must have @page rule');
  });

  test('has SVG health ring', () => {
    assert.ok(content.includes('<svg'), 'Must have inline SVG');
    assert.ok(content.includes('<circle'), 'Must have SVG circle for health ring');
    assert.ok(content.includes('stroke-dasharray'), 'Must use dasharray for progress ring');
  });

  test('has health score placeholder', () => {
    assert.ok(content.includes('{{health_score}}'), 'Missing health_score placeholder');
    assert.ok(content.includes('{{risk_tier}}'), 'Missing risk_tier placeholder');
    assert.ok(content.includes('{{score_color}}'), 'Missing score_color placeholder');
  });

  test('has six health dimensions', () => {
    assert.ok(content.includes('Complexity'), 'Missing Complexity dimension');
    assert.ok(content.includes('Test Coverage'), 'Missing Test Coverage dimension');
    assert.ok(content.includes('Documentation'), 'Missing Documentation dimension');
    assert.ok(content.includes('Dependencies'), 'Missing Dependencies dimension');
    assert.ok(content.includes('Code Smells'), 'Missing Code Smells dimension');
    assert.ok(content.includes('Maintenance'), 'Missing Maintenance dimension');
  });

  test('has module health table', () => {
    assert.ok(content.includes('Module Health'), 'Missing Module Health section');
    assert.ok(content.includes('{{module_name}}'), 'Missing module_name placeholder');
    assert.ok(content.includes('{{module_score}}'), 'Missing module_score placeholder');
  });

  test('has surgery queue section', () => {
    assert.ok(content.includes('Surgery Queue'), 'Missing Surgery Queue section');
    assert.ok(content.includes('{{surgery_module}}'), 'Missing surgery_module placeholder');
    assert.ok(content.includes('{{surgery_pattern}}'), 'Missing surgery_pattern placeholder');
  });

  test('has risk assessment section', () => {
    assert.ok(content.includes('Risk Assessment'), 'Missing Risk Assessment section');
    assert.ok(content.includes('Git Archaeology'), 'Missing Git Archaeology section');
  });

  test('has cross-domain impact table', () => {
    assert.ok(content.includes('Cross-Domain Impact'), 'Missing Cross-Domain Impact section');
    assert.ok(content.includes('{{domain_name}}'), 'Missing domain_name placeholder');
  });

  test('has recommended actions', () => {
    assert.ok(content.includes('Recommended Actions'), 'Missing Recommended Actions section');
  });

  test('has Rune Business footer', () => {
    assert.ok(content.includes('Rune Business'), 'Missing Rune Business branding');
    assert.ok(content.includes('autopsy --executive'), 'Missing autopsy --executive reference');
  });

  test('has board-ready label', () => {
    assert.ok(content.includes('Board-ready'), 'Should mention board-ready format');
  });
});

// ─── Skill integration validation ─────────────────────────────────

describe('retro skill --business integration', () => {
  const retroPath = path.join(SKILLS_DIR, 'retro', 'SKILL.md');
  const content = readFileSync(retroPath, 'utf-8');

  test('retro has --business trigger', () => {
    assert.ok(content.includes('retro --business'), 'retro should document --business mode');
  });

  test('retro --business references HTML report', () => {
    assert.ok(content.includes('.html'), 'retro --business should reference HTML output');
  });

  test('retro --business references cross-domain data', () => {
    assert.ok(
      content.includes('Revenue') || content.includes('revenue'),
      'retro --business should reference revenue domain',
    );
    assert.ok(
      content.includes('Support') || content.includes('support'),
      'retro --business should reference support domain',
    );
    assert.ok(
      content.includes('Finance') || content.includes('finance'),
      'retro --business should reference finance domain',
    );
  });

  test('retro --business references org config', () => {
    assert.ok(
      content.includes('.rune/org/org.md'),
      'retro --business should reference org config',
    );
  });

  test('retro --business has graceful degradation', () => {
    assert.ok(
      content.includes('Graceful Degradation') || content.includes('graceful'),
      'retro --business should handle missing Business pack gracefully',
    );
  });

  test('retro --business references report template', () => {
    assert.ok(
      content.includes('retro-business.html'),
      'retro should reference the HTML template file',
    );
  });
});

describe('autopsy skill --executive integration', () => {
  const autopsyPath = path.join(SKILLS_DIR, 'autopsy', 'SKILL.md');
  const content = readFileSync(autopsyPath, 'utf-8');

  test('autopsy has --executive mode', () => {
    assert.ok(content.includes('--executive'), 'autopsy should document --executive mode');
  });

  test('autopsy --executive references HTML report', () => {
    assert.ok(
      content.includes('EXECUTIVE-HEALTH.html'),
      'autopsy --executive should reference EXECUTIVE-HEALTH.html output',
    );
  });

  test('autopsy --executive references SVG health ring', () => {
    assert.ok(
      content.includes('SVG') || content.includes('svg'),
      'autopsy --executive should reference SVG health ring',
    );
  });

  test('autopsy --executive has color coding table', () => {
    assert.ok(
      content.includes('Color Coding') || content.includes('color'),
      'autopsy --executive should define color coding',
    );
  });

  test('autopsy --executive references org config', () => {
    assert.ok(
      content.includes('.rune/org/org.md'),
      'autopsy --executive should reference org config for team mapping',
    );
  });

  test('autopsy --executive references report template', () => {
    assert.ok(
      content.includes('autopsy-executive.html'),
      'autopsy should reference the HTML template file',
    );
  });

  test('autopsy --executive has cross-domain impact', () => {
    assert.ok(
      content.includes('Cross-Domain') || content.includes('cross-domain'),
      'autopsy --executive should map to business domains',
    );
  });

  test('autopsy --executive has graceful degradation', () => {
    assert.ok(
      content.includes('Graceful Degradation') || content.includes('graceful'),
      'autopsy --executive should handle missing Business pack',
    );
  });
});
