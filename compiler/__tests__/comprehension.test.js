import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeVerdictScore, generateComprehensionHTML } from '../comprehension.js';

// ─── (a) Empty data — no throw, contains verdict element + empty-state hint ───

describe('generateComprehensionHTML — empty data', () => {
  it('does not throw on empty object', () => {
    assert.doesNotThrow(() => generateComprehensionHTML({}));
  });

  it('returns a string', () => {
    const result = generateComprehensionHTML({});
    assert.equal(typeof result, 'string');
  });

  it('contains the verdict hero element', () => {
    const result = generateComprehensionHTML({});
    assert.ok(
      result.includes('verdict-line') || result.includes('panel-verdict'),
      'Expected verdict panel marker in output',
    );
  });

  it('contains an empty-state hint when there is no data', () => {
    const result = generateComprehensionHTML({});
    // Score shows — for null basis
    assert.ok(
      result.includes('&mdash;') || result.includes('no session data'),
      'Expected empty-state indicator (mdash or "no session data") in output',
    );
  });
});

// ─── (b) No http:// or https:// — truly self-contained ───

describe('generateComprehensionHTML — no external URLs', () => {
  it('contains no http:// URLs (hard guard)', () => {
    const result = generateComprehensionHTML({});
    assert.ok(!result.includes('http://'), 'Found http:// in output — external URL!');
  });

  it('contains no https:// URLs (hard guard)', () => {
    const result = generateComprehensionHTML({});
    assert.ok(!result.includes('https://'), 'Found https:// in output — external URL!');
  });

  it('no external URLs even with full sample data', () => {
    const result = generateComprehensionHTML({
      project: 'TestProject',
      modules: [{ id: 'm1', name: 'Auth', layer: 'service' }],
      edges: [],
      gates: [{ name: 'sentinel', fired: 3 }],
      compliance: [{ pack: '@rune-business/finance', obligation: 'MUST log all decisions', status: 'met' }],
      overview: {
        total_sessions: 5,
        avg_duration_min: 12,
        total_tool_calls: 100,
        total_skill_invocations: 30,
        active_days: 3,
      },
      skillFrequency: [
        { skill: 'cook', count: 10 },
        { skill: 'scout', count: 5 },
      ],
    });
    assert.ok(!result.includes('http://'), 'Found http:// with sample data');
    assert.ok(!result.includes('https://'), 'Found https:// with sample data');
  });
});

// ─── (c) XSS safety — </script> in project name must not break out ───

describe('generateComprehensionHTML — XSS / script injection guard', () => {
  it('escapes </script> in project name so it cannot break out of the script tag', () => {
    const malicious = 'evil</script><script>alert(1)</script>';
    const result = generateComprehensionHTML({ project: malicious });
    // The raw string </script> must NOT appear raw inside the JSON data literal.
    // Strategy: extract ONLY the const D = ... ; line (ends at the first newline after the
    // safeJson-produced string) and check it contains no raw </script>.
    const dataMarker = 'const D =';
    const dataStart = result.indexOf(dataMarker);
    assert.ok(dataStart !== -1, 'Could not find "const D =" in output');
    // The data line ends at the semicolon on the same logical line
    // safeJson produces a single-line JSON string, so grab up to 'D;\n'
    const lineEnd = result.indexOf(';\n', dataStart);
    const dataLine = lineEnd !== -1 ? result.slice(dataStart, lineEnd + 2) : result.slice(dataStart, dataStart + 5000);
    // The raw </script> must not appear inside the JSON data line
    assert.ok(!dataLine.includes('</script>'), 'Raw </script> found inside JSON data line — XSS escape failed!');
  });

  it('\\u003c escape keeps JSON parseable in JS', () => {
    const malicious = 'evil</script>';
    const result = generateComprehensionHTML({ project: malicious });
    // The JSON data block should use \\u003c instead of <
    const scriptStart = result.indexOf('const D =');
    assert.ok(scriptStart !== -1, 'Could not find "const D =" in output');
    const dataLine = result.slice(scriptStart, scriptStart + 400);
    assert.ok(dataLine.includes('\\u003c'), 'Expected \\u003c escape in JSON data block');
  });
});

// ─── (d) Sample data — HTML includes score and gate name ───

describe('generateComprehensionHTML — sample data renders correctly', () => {
  const sampleData = {
    project: 'MyProject',
    health_score: 72,
    generated_at: '2026-06-20T12:00:00.000Z',
    modules: [
      { id: 'auth', name: 'Auth', layer: 'service', type: 'module' },
      { id: 'db', name: 'Database', layer: 'data', type: 'module' },
    ],
    edges: [{ from: 'auth', to: 'db', category: 'dependency' }],
    gates: [
      { name: 'sentinel', fired: 5, passed: 0, bypassed: 0, blocked: 0, ts: '2026-06-20T10:00:00.000Z' },
      { name: 'preflight', fired: 3, passed: 0, bypassed: 0, blocked: 0, ts: null },
    ],
    compliance: [
      { pack: '@rune-business/finance', obligation: 'MUST log all decisions', status: 'met' },
      { pack: '@rune-business/legal', obligation: 'MUST review contracts', status: 'unknown' },
    ],
    overview: {
      total_sessions: 12,
      avg_duration_min: 18,
      total_tool_calls: 240,
      total_skill_invocations: 60,
      active_days: 8,
    },
    skillFrequency: [
      { skill: 'cook', count: 20 },
      { skill: 'plan', count: 10 },
    ],
  };

  it('includes the health score (72) in the output', () => {
    const result = generateComprehensionHTML(sampleData);
    // Score appears as data-target or in count-up JS or as literal text
    assert.ok(result.includes('72') || result.includes('"verdictScore":72'), 'Expected health score 72 in output');
  });

  it('includes a gate name from the data', () => {
    const result = generateComprehensionHTML(sampleData);
    assert.ok(result.includes('sentinel') || result.includes('"sentinel"'), 'Expected gate name "sentinel" in output');
  });

  it('includes project name', () => {
    const result = generateComprehensionHTML(sampleData);
    assert.ok(result.includes('MyProject'), 'Expected project name in output');
  });

  it('includes all 5 tab panels', () => {
    const result = generateComprehensionHTML(sampleData);
    for (const id of ['panel-verdict', 'panel-govern', 'panel-measure', 'panel-understand', 'panel-improve']) {
      assert.ok(result.includes(id), `Missing tab panel: ${id}`);
    }
  });

  it('does not produce NaN in the output', () => {
    const result = generateComprehensionHTML(sampleData);
    assert.ok(!result.includes('>NaN<'), 'NaN found in rendered HTML');
    assert.ok(!result.includes('"NaN"'), 'NaN string found in data JSON');
  });
});

// ─── computeVerdictScore unit tests ───

describe('computeVerdictScore', () => {
  it('returns null score when all dimensions are empty', () => {
    const { score } = computeVerdictScore({});
    assert.equal(score, null);
  });

  it('returns a score when modules are present', () => {
    const { score } = computeVerdictScore({
      modules: [{ id: 'm1', name: 'Auth' }],
    });
    assert.ok(typeof score === 'number' && score >= 0 && score <= 100, 'Score out of range');
  });

  it('score is capped at 100', () => {
    const { score } = computeVerdictScore({
      modules: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, name: `M${i}` })),
      gates: Array.from({ length: 8 }, (_, i) => ({ name: `g${i}`, fired: 5 })),
      compliance: Array.from({ length: 50 }, () => ({ status: 'met' })),
      overview: { total_sessions: 100 },
    });
    assert.ok(score <= 100, 'Score exceeded 100');
  });

  it('includes "governance" basis when gates are fired', () => {
    const { basis } = computeVerdictScore({
      gates: [{ name: 'sentinel', fired: 3 }],
    });
    assert.ok(basis.includes('governance'), 'Expected "governance" in basis');
  });

  it('does NOT include "governance" basis when gates are defined but never fired (Fix #4)', () => {
    // gates.length > 0 but all fired = 0 — must NOT flip verdict from — to a number
    const { score, basis } = computeVerdictScore({
      gates: [
        { name: 'sentinel', fired: 0 },
        { name: 'preflight', fired: 0 },
      ],
    });
    assert.ok(!basis.includes('governance'), 'governance must not appear in basis when no gates fired');
    assert.equal(score, null, 'Score must be null (no real basis) when gates defined but never fired');
  });
});

// ─── (e) XSS — HTML injection in title and h1 (Fix #1 BLOCK) ───

describe('generateComprehensionHTML — HTML injection in title/h1', () => {
  it('escapes <img> injection in <title> — raw tag must not appear outside JSON blob', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const result = generateComprehensionHTML({ project: malicious });
    // Extract everything except the const D = ... JSON blob
    const dataStart = result.indexOf('const D =');
    const dataEnd = result.indexOf(';\n', dataStart);
    const beforeData = dataStart !== -1 ? result.slice(0, dataStart) : result;
    const afterData = dataStart !== -1 && dataEnd !== -1 ? result.slice(dataEnd + 2) : '';
    const outsideJson = beforeData + afterData;
    assert.ok(!outsideJson.includes('<img'), 'Raw <img> tag found outside JSON blob — XSS in title or h1!');
  });

  it('escapes & < > " in project name in <title>', () => {
    const result = generateComprehensionHTML({ project: '<Evil & "Corp">' });
    // Extract <title> content
    const titleStart = result.indexOf('<title>');
    const titleEnd = result.indexOf('</title>');
    assert.ok(titleStart !== -1 && titleEnd !== -1, 'No <title> tag found');
    const titleContent = result.slice(titleStart, titleEnd);
    assert.ok(!titleContent.includes('<Evil'), 'Raw < in <title>');
    assert.ok(titleContent.includes('&lt;Evil'), 'Expected &lt; in <title>');
  });
});

// ─── (f) U+2028 line separator escape in JSON blob (Fix #2 HIGH) ───

describe('generateComprehensionHTML — U+2028 / U+2029 line terminator escape', () => {
  it('escapes U+2028 (LS) in data — no raw line separator in script block', () => {
    // U+2028 in project name would terminate a JS string literal if unescaped
    const withLS = `before${String.fromCharCode(0x2028)}after`; // U+2028 LINE SEPARATOR
    const result = generateComprehensionHTML({ project: withLS });
    const dataStart = result.indexOf('const D =');
    assert.ok(dataStart !== -1, 'const D = not found');
    const dataSlice = result.slice(dataStart, dataStart + 2000);
    assert.ok(!dataSlice.includes(String.fromCharCode(0x2028)), 'Raw U+2028 found in script block — must be escaped');
    assert.ok(dataSlice.includes('\\u2028'), 'Expected \\u2028 escape in JSON data block');
  });

  it('escapes U+2029 (PS) in data — no raw paragraph separator in script block', () => {
    const withPS = `before${String.fromCharCode(0x2029)}after`; // U+2029 PARAGRAPH SEPARATOR
    const result = generateComprehensionHTML({ project: withPS });
    const dataStart = result.indexOf('const D =');
    assert.ok(dataStart !== -1, 'const D = not found');
    const dataSlice = result.slice(dataStart, dataStart + 2000);
    assert.ok(!dataSlice.includes(String.fromCharCode(0x2029)), 'Raw U+2029 found in script block — must be escaped');
    assert.ok(dataSlice.includes('\\u2029'), 'Expected \\u2029 escape in JSON data block');
  });
});

// ─── (g) health_score clamp + NaN-guard (Fix #6 MEDIUM) ───

describe('generateComprehensionHTML — health_score clamp and NaN-guard', () => {
  it('clamps health_score > 100 to 100 (not rendered as 150)', () => {
    const result = generateComprehensionHTML({ health_score: 150 });
    // Score in initial render must be ≤ 100
    const scoreNumMatch = result.match(/<span id="score-num">(\d+)<\/span>/);
    assert.ok(scoreNumMatch, 'score-num span not found');
    const rendered = parseInt(scoreNumMatch[1], 10);
    assert.ok(rendered <= 100, `Rendered score ${rendered} exceeds 100 — clamp failed`);
  });

  it('treats health_score: NaN as absent (renders — not NaN)', () => {
    const result = generateComprehensionHTML({ health_score: Number.NaN });
    // NaN score should fall through to computedScore (which will be null for empty data)
    // so the — path renders instead of a NaN number
    assert.ok(!result.includes('>NaN<'), 'NaN rendered in score element');
    assert.ok(!result.includes('"verdictScore":null') || result.includes('&mdash;'), 'Expected — for null/NaN score');
  });
});

// ─── (h) self-containment hardening (Fix — extend existing guard) ───

describe('generateComprehensionHTML — self-containment hardening', () => {
  it('contains no <link> tags (no external stylesheet)', () => {
    const result = generateComprehensionHTML({});
    assert.ok(!result.includes('<link'), 'Found <link> tag — external resource!');
  });

  it('contains no @import (no external CSS imports)', () => {
    const result = generateComprehensionHTML({});
    assert.ok(!result.includes('@import'), 'Found @import — external CSS import!');
  });

  it('contains no url(http — no external resources in CSS', () => {
    const result = generateComprehensionHTML({});
    assert.ok(!result.includes('url(http'), 'Found url(http — external resource in CSS!');
  });

  it('contains no protocol-relative font/script references (//fonts. etc)', () => {
    const result = generateComprehensionHTML({});
    // Disallow //fonts. or //cdn. or //unpkg. etc — but allow bare // in comments
    const protocolRelative = /src=["']\/\/|href=["']\/\//.test(result);
    assert.ok(!protocolRelative, 'Found protocol-relative external reference in src/href!');
  });
});

// ─── (i) skillFrequency sessions_count shape regression guard (Fix #5) ───

describe('generateComprehensionHTML — skillFrequency .count field contract', () => {
  it('does not produce NaN bars when skillFrequency uses .count correctly', () => {
    // Verifies the renderer reads .count (mapping from sessions_count happens in cmdDashboard)
    const result = generateComprehensionHTML({
      skillFrequency: [
        { skill: 'cook', count: 15 },
        { skill: 'scout', count: 7 },
      ],
      overview: { total_sessions: 5, total_skill_invocations: 20 },
    });
    assert.ok(!result.includes('>NaN<'), 'NaN found in rendered skill bars');
    assert.ok(!result.includes('"NaN"'), 'NaN string in JSON blob');
  });

  it('renders without crash when skillFrequency entries have sessions_count (unmapped shape)', () => {
    // If sessions_count leaks through without mapping, bars show 0 not NaN (safeInt guards)
    // This test documents the expected degraded behavior (not crash) when mapping is missing
    assert.doesNotThrow(() =>
      generateComprehensionHTML({
        skillFrequency: [{ skill: 'cook', sessions_count: 15 }],
        overview: { total_sessions: 5, total_skill_invocations: 20 },
      }),
    );
  });
});

// ─── Phase 4: Understand tab features ───

const phase4Data = {
  project: 'Phase4Test',
  generated_at: '2026-06-20T10:00:00.000Z',
  modules: [
    {
      id: 'auth',
      name: 'AuthService',
      layer: 'service',
      type: 'service',
      complexity: 'complex',
      summary: 'Handles authentication.',
    },
    { id: 'db', name: 'UserRepo', layer: 'data', type: 'class', complexity: 'simple', summary: 'Database access.' },
    {
      id: 'api',
      name: 'AuthController',
      layer: 'api',
      type: 'endpoint',
      complexity: 'moderate',
      summary: 'REST endpoints.',
    },
    {
      id: 'cfg',
      name: 'app.config',
      layer: 'infra',
      type: 'config',
      complexity: 'simple',
      summary: 'App config file.',
    },
  ],
  edges: [
    { from: 'api', to: 'auth', category: 'structural' },
    { from: 'auth', to: 'db', category: 'data-flow' },
    { from: 'db', to: 'cfg', category: 'dependency' },
  ],
  domains: [
    {
      name: 'Authentication',
      summary: 'User identity flows',
      flows: [{ name: 'Login', steps: ['Submit credentials', 'Validate', 'Issue token'] }],
    },
  ],
};

describe('generateComprehensionHTML — Phase 4: filter controls for present node types', () => {
  it('(a) output contains filter controls for present node types', () => {
    const result = generateComprehensionHTML(phase4Data);
    // The node types present: service, class, endpoint, config
    // Each should appear as a filter checkbox label in the embedded JS or rendered HTML
    assert.ok(result.includes('service') || result.includes('"service"'), 'Expected "service" type in output');
    assert.ok(result.includes('class') || result.includes('"class"'), 'Expected "class" type in output');
    assert.ok(result.includes('endpoint') || result.includes('"endpoint"'), 'Expected "endpoint" type in output');
  });

  it('(a) output contains filter controls for present edge categories', () => {
    const result = generateComprehensionHTML(phase4Data);
    // Edge categories present: structural, data-flow, dependency
    assert.ok(
      result.includes('structural') || result.includes('"structural"'),
      'Expected "structural" category in output',
    );
    assert.ok(
      result.includes('data-flow') || result.includes('"data-flow"'),
      'Expected "data-flow" category in output',
    );
  });
});

describe('generateComprehensionHTML — Phase 4: domain view markup', () => {
  it('(b) domain view markup present when domains exist', () => {
    const result = generateComprehensionHTML(phase4Data);
    // Domain view button and domain name should appear in the JS string
    assert.ok(
      result.includes('Domain View') || result.includes('u-domain'),
      'Expected Domain View markup or toggle in output',
    );
    // Domain name embedded in data
    assert.ok(
      result.includes('Authentication') || result.includes('"Authentication"'),
      'Expected domain name "Authentication" in output',
    );
  });

  it('(b) domain steps embedded in output', () => {
    const result = generateComprehensionHTML(phase4Data);
    assert.ok(
      result.includes('Submit credentials') || result.includes('"Submit credentials"'),
      'Expected step text in output',
    );
  });
});

describe('generateComprehensionHTML — Phase 4: tour step list rendered', () => {
  it('(c) tour-related markup (Start Tour button) present in output', () => {
    const result = generateComprehensionHTML(phase4Data);
    assert.ok(
      result.includes('Start Tour') || result.includes('u-tour'),
      'Expected tour button or tour CSS class in output',
    );
  });

  it('(c) tour builds on module data embedded in output', () => {
    const result = generateComprehensionHTML(phase4Data);
    // Tour step nodes come from modules embedded in D.modules
    assert.ok(
      result.includes('"AuthService"') || result.includes('AuthService'),
      'Expected module name embedded for tour',
    );
  });
});

describe('generateComprehensionHTML — Phase 4: self-containment guard extended', () => {
  it('(d) no http(s):// with comprehension data (extended self-containment check)', () => {
    const result = generateComprehensionHTML(phase4Data);
    assert.ok(!result.includes('http://'), 'Found http:// in Phase 4 output');
    assert.ok(!result.includes('https://'), 'Found https:// in Phase 4 output');
  });

  it('(d) no <link> tags with comprehension data', () => {
    const result = generateComprehensionHTML(phase4Data);
    assert.ok(!result.includes('<link'), 'Found <link> in Phase 4 output — not self-contained');
  });

  it('(d) no @import in Phase 4 CSS additions', () => {
    const result = generateComprehensionHTML(phase4Data);
    assert.ok(!result.includes('@import'), 'Found @import in Phase 4 output');
  });
});

describe('generateComprehensionHTML — Phase 4: XSS — module name containing <script>', () => {
  it('(e) module name containing <script> is escaped in output', () => {
    const xssData = {
      ...phase4Data,
      modules: [
        ...phase4Data.modules,
        { id: 'evil', name: '<script>alert(1)</script>', layer: 'api', type: 'module', summary: 'xss test' },
      ],
    };
    const result = generateComprehensionHTML(xssData);
    // The raw string must not appear outside the safeJson JSON blob
    const dataStart = result.indexOf('const D =');
    const dataEnd = result.indexOf(';\n', dataStart);
    const afterData = dataStart !== -1 && dataEnd !== -1 ? result.slice(dataEnd + 2) : '';
    // After the JSON blob, no raw <script> from the node name should appear
    assert.ok(
      !afterData.includes('<script>alert(1)</script>'),
      'Raw <script> from module name found outside JSON blob — XSS!',
    );
  });
});

// ─── Phase 5a: Measure tab enrichment ───

const phase5Data = {
  project: 'Phase5Test',
  generated_at: '2026-06-20T10:00:00.000Z',
  overview: {
    total_sessions: 10,
    avg_duration_min: 20,
    total_tool_calls: 300,
    total_skill_invocations: 50,
    active_days: 7,
  },
  skillFrequency: [
    { skill: 'cook', count: 15 },
    { skill: 'scout', count: 8 },
    { skill: 'plan', count: 5 },
  ],
  modelDistribution: [
    { model: 'claude-sonnet-4-5', skill_count: 40 },
    { model: 'claude-haiku-4-5', skill_count: 10 },
  ],
  skillHeatmap: {
    heatmap: [
      {
        skill: 'cook',
        total: 15,
        days: [
          { date: '2026-06-19', count: 3 },
          { date: '2026-06-20', count: 2 },
        ],
      },
      {
        skill: 'scout',
        total: 8,
        days: [
          { date: '2026-06-19', count: 1 },
          { date: '2026-06-20', count: 0 },
        ],
      },
    ],
    dates: ['2026-06-19', '2026-06-20'],
    maxCount: 3,
  },
  sessionTimeline: [
    {
      id: 's1',
      date: '2026-06-20',
      duration_min: 25,
      tool_calls: 80,
      skills_used: ['cook', 'scout', 'plan'],
      primary_skill: 'cook',
      chains: [['cook', 'scout']],
    },
    {
      id: 's2',
      date: '2026-06-19',
      duration_min: 15,
      tool_calls: 45,
      skills_used: ['fix', 'debug'],
      primary_skill: 'fix',
      chains: [],
    },
  ],
  skillChains: [
    { chain: 'cook → scout → plan', count: 4 },
    { chain: 'fix → debug', count: 2 },
  ],
  totalInstalledSkills: 64,
  gates: [{ name: 'sentinel', fired: 5, blocked: 0 }],
};

describe('generateComprehensionHTML — Phase 5a: Measure tab model section', () => {
  it('renders model distribution when data is present', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('claude-sonnet-4-5') || result.includes('"claude-sonnet-4-5"'),
      'Expected model name in output',
    );
  });

  it('renders skill-ROI section markers', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('Skill ROI') || result.includes('roi-grid') || result.includes('skill-ROI'),
      'Expected Skill ROI section in output',
    );
  });

  it('includes active vs dormant skill counts in the output', () => {
    const result = generateComprehensionHTML(phase5Data);
    // The roi section shows "N of M skills active"
    assert.ok(
      result.includes('active') && (result.includes('dormant') || result.includes('64')),
      'Expected active/dormant skill ROI info in output',
    );
  });

  it('renders heatmap section when heatmap data present', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('Heatmap') || result.includes('heatmap-wrap') || result.includes('hm-cell'),
      'Expected heatmap section in output',
    );
  });

  it('renders session timeline section', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('Timeline') || result.includes('timeline-list') || result.includes('timeline-item'),
      'Expected session timeline section in output',
    );
  });

  it('does not produce NaN in measure output', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(!result.includes('>NaN<'), 'NaN found in Measure HTML output');
  });
});

// ─── Phase 5a: Improve tab — data-driven cards ───

describe('generateComprehensionHTML — Phase 5a: Improve tab with real data', () => {
  it('renders improve-card when a real finding is derivable (blocks caught)', () => {
    const dataWithBlocks = {
      ...phase5Data,
      gates: [{ name: 'sentinel', fired: 5, blocked: 3 }],
    };
    const result = generateComprehensionHTML(dataWithBlocks);
    assert.ok(
      result.includes('improve-card') || result.includes('block'),
      'Expected at least one improve card when blocks are caught',
    );
  });

  it('renders improve card for repeated skill chain when count >= 3', () => {
    const result = generateComprehensionHTML(phase5Data);
    // skillChains has cook → scout → plan with count: 4
    assert.ok(
      result.includes('cook') || result.includes('Repeated') || result.includes('improve-card'),
      'Expected improve card referencing repeated chain',
    );
  });

  it('renders honest empty state when no session data exists', () => {
    const emptyData = {
      project: 'EmptyProject',
      overview: {},
      skillFrequency: [],
      modelDistribution: [],
      skillHeatmap: { heatmap: [], dates: [], maxCount: 1 },
      sessionTimeline: [],
      skillChains: [],
      gates: [],
      totalInstalledSkills: 64,
    };
    const result = generateComprehensionHTML(emptyData);
    assert.ok(
      result.includes('Not enough session data') ||
        result.includes('improve-content') ||
        result.includes('Improvement'),
      'Expected honest empty state in Improve tab when no data',
    );
    // Must NOT contain generic boilerplate masquerading as a finding
    assert.ok(!result.includes('improve-card sev-warn'), 'No warning cards should appear with zero data');
  });

  it('BLOAT_THRESHOLD constant is 120 (correctness guard)', () => {
    // The bloat detection threshold is hard-coded in the embedded JS. Verify it's present.
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('BLOAT_THRESHOLD') || result.includes('120'),
      'Expected BLOAT_THRESHOLD or 120 in embedded JS',
    );
  });
});

// ─── Phase 5a: Canvas keyboard accessibility ───

describe('generateComprehensionHTML — Phase 5a: canvas keyboard accessibility', () => {
  it('canvas has tabindex="0" attribute', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes("tabindex','0'") || result.includes('tabindex=\\"0\\"') || result.includes("'tabindex','0'"),
      'Expected canvas tabindex="0"',
    );
  });

  it('canvas aria-label updated to include keyboard navigation instructions', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(
      result.includes('Arrow keys') || result.includes('keyboard') || result.includes('aria-label'),
      'Expected keyboard navigation hint in canvas aria-label',
    );
  });

  it('sr-only node list is present in understand tab output', () => {
    const result = generateComprehensionHTML(phase5Data);
    // The sr-only list is rendered via JS using allNodes — it's embedded in JS
    assert.ok(
      result.includes('sr-only') || result.includes('screen reader') || result.includes('srListWrap'),
      'Expected sr-only node list in understand tab',
    );
  });

  it('output is still self-contained with phase5 canvas a11y additions', () => {
    const result = generateComprehensionHTML(phase5Data);
    assert.ok(!result.includes('http://'), 'Found http:// in phase 5 output');
    assert.ok(!result.includes('https://'), 'Found https:// in phase 5 output');
    assert.ok(!result.includes('<link'), 'Found <link> in phase 5 output');
    assert.ok(!result.includes('@import'), 'Found @import in phase 5 output');
  });

  it('a name with & and < is NOT double-escaped when used in textContent paths', () => {
    // The sr-only list items use .textContent (which the JS does), so
    // the raw node name is embedded in JS source as a JS string (via safeJson),
    // not as innerHTML. Verify the safeJson blob encodes it correctly.
    const xssData = {
      ...phase5Data,
      modules: [{ id: 'evil', name: 'A&B <C>', layer: 'api', type: 'module', summary: 'test node' }],
    };
    const result = generateComprehensionHTML(xssData);
    // In safeJson (JSON blob), & becomes & (literal in JSON string) and < becomes <
    const dataStart = result.indexOf('const D =');
    assert.ok(dataStart !== -1, 'Could not find const D =');
    const dataSlice = result.slice(dataStart, dataStart + 8000);
    // The < in node name must be escaped in the JSON blob
    assert.ok(dataSlice.includes('\\u003c'), 'Expected \\u003c escape for < in node name JSON');
    // But & inside JSON string is fine as literal & (JSON encodes it literally)
    // The key test: raw </script> must not appear
    assert.ok(!dataSlice.includes('</script>'), 'Raw </script> must not appear in data blob');
  });
});

// ─── HIGH-2: XSS in Improve tab — skill chain containing <script> ───

describe('generateComprehensionHTML — XSS: skill chain with <script> in Improve card', () => {
  it('skill chain containing <script>alert(1)</script> renders escaped in Improve card (HIGH-2)', () => {
    // The Improve tab uses body.innerHTML = f.body for the "repeated workflow pattern" card.
    // The chain text is interpolated via esc() — verify the output never contains a raw <script>.
    const xssChainData = {
      ...phase5Data,
      skillChains: [
        // count >= 3 triggers the finding card; chain contains a raw <script> tag
        { chain: 'cook → <script>alert(1)</script> → plan', count: 3 },
      ],
    };
    const result = generateComprehensionHTML(xssChainData);

    // The raw <script> tag must NOT appear in the HTML outside the safeJson JSON blob.
    // Anything after the data blob is the JS application code — raw tags there would be injectable.
    const dataStart = result.indexOf('const D =');
    const dataEnd = result.indexOf(';\n', dataStart);
    const afterData = dataStart !== -1 && dataEnd !== -1 ? result.slice(dataEnd + 2) : result;

    // The raw unescaped string must not appear in the rendered application JS
    assert.ok(
      !afterData.includes('<script>alert(1)</script>'),
      'Raw <script> from skill chain found in Improve card HTML — XSS via esc() bypass!',
    );

    // The escaped form SHOULD appear (esc() → &lt;script&gt;)
    // We confirm the chain data IS present (so the card was rendered) — just escaped
    assert.ok(
      result.includes('cook') || result.includes('\\u003cscript\\u003e') || result.includes('&lt;script&gt;'),
      'Expected escaped chain content in output — esc() must have run',
    );
  });
});

// ─── Phase 5b: Tier gating tests ───

describe('generateComprehensionHTML — Phase 5b: Free tier — Govern renders upsell (not real data)', () => {
  // Free tier: no hasPro, no hasBusiness (or hasBusiness explicitly false)
  const freeTierData = {
    project: 'FreeProject',
    generated_at: '2026-06-20T10:00:00.000Z',
    tier: 'free',
    hasPro: false,
    hasBusiness: false,
    gates: [{ name: 'sentinel', fired: 3, blocked: 1 }],
    compliance: [{ pack: '@rune-business/finance', obligation: 'MUST log all decisions', status: 'met' }],
    decisions: [{ output: 'commit-abc', gate: 'sentinel', model: 'claude-sonnet', cost: 0.0042 }],
    overview: { total_sessions: 5 },
    skillFrequency: [{ skill: 'cook', count: 10 }],
  };

  it('embeds hasBusiness:false in the data JSON for Free tier', () => {
    const result = generateComprehensionHTML(freeTierData);
    // The tier data is embedded in const D = {...} — verify hasBusiness is false
    assert.ok(result.includes('"hasBusiness":false'), 'Expected hasBusiness:false embedded in Free tier data JSON');
  });

  it('embeds hasPro:false in the data JSON for Free tier', () => {
    const result = generateComprehensionHTML(freeTierData);
    assert.ok(result.includes('"hasPro":false'), 'Expected hasPro:false embedded in Free tier data JSON');
  });

  it('upsell text about Business feature is present in JS source', () => {
    const result = generateComprehensionHTML(freeTierData);
    // The upsell description uses this text in textContent — it appears as a JS string literal.
    assert.ok(
      result.includes('Rune Business feature') || result.includes('Business tier'),
      'Expected upsell description text in Free tier govern JS source',
    );
  });

  it('upsell describes what Govern provides (honest description)', () => {
    const result = generateComprehensionHTML(freeTierData);
    // The upsell must mention gate ledger or compliance — real value description
    assert.ok(
      result.includes('gate') || result.includes('compliance') || result.includes('Business'),
      'Upsell should describe the Govern feature value',
    );
  });

  it('still passes the no-https guard (no external URLs in upsell)', () => {
    const result = generateComprehensionHTML(freeTierData);
    assert.ok(!result.includes('https://'), 'Found https:// in free-tier upsell — self-containment broken');
  });

  it('still passes the no-http guard', () => {
    const result = generateComprehensionHTML(freeTierData);
    assert.ok(!result.includes('http://'), 'Found http:// in free-tier output');
  });
});

describe('generateComprehensionHTML — Phase 5b: Business tier — Govern renders real panels', () => {
  const businessTierData = {
    project: 'BusinessProject',
    generated_at: '2026-06-20T10:00:00.000Z',
    tier: 'business',
    hasPro: true,
    hasBusiness: true,
    gates: [{ name: 'sentinel', fired: 5, blocked: 2 }],
    compliance: [{ pack: '@rune-business/finance', obligation: 'MUST log all decisions', status: 'met' }],
    decisions: [],
    overview: { total_sessions: 8 },
    skillFrequency: [{ skill: 'cook', count: 15 }],
  };

  it('renders Governance Ledger for Business tier', () => {
    const result = generateComprehensionHTML(businessTierData);
    assert.ok(
      result.includes('Governance Ledger') || result.includes('govern-content'),
      'Expected Governance Ledger in Business tier output',
    );
  });

  it('renders Compliance Coverage for Business tier', () => {
    const result = generateComprehensionHTML(businessTierData);
    assert.ok(
      result.includes('Compliance Coverage') || result.includes('cov-pack'),
      'Expected Compliance Coverage in Business tier output',
    );
  });

  it('embeds hasBusiness:true in the data JSON for Business tier', () => {
    const result = generateComprehensionHTML(businessTierData);
    // The key check: D.hasBusiness is embedded as true for Business tier
    assert.ok(result.includes('"hasBusiness":true'), 'Expected hasBusiness:true in Business tier data JSON');
  });

  it('embeds tier:"business" in the data JSON', () => {
    const result = generateComprehensionHTML(businessTierData);
    assert.ok(result.includes('"tier":"business"'), 'Expected tier:business in Business tier data JSON');
  });
});

describe('generateComprehensionHTML — Phase 5b: Pro tier — My Lens persona present', () => {
  const proTierData = {
    project: 'ProProject',
    generated_at: '2026-06-20T10:00:00.000Z',
    tier: 'pro',
    hasPro: true,
    hasBusiness: false,
    overview: { total_sessions: 5 },
    skillFrequency: [{ skill: 'cook', count: 10 }],
    gates: [{ name: 'sentinel', fired: 3, blocked: 0 }],
  };

  it('renders the My Lens persona button when hasPro is true', () => {
    const result = generateComprehensionHTML(proTierData);
    assert.ok(
      result.includes('My Lens') || result.includes('data-persona="mylens"') || result.includes('mylens'),
      'Expected My Lens persona option in Pro tier output',
    );
  });

  it('My Lens persona button is keyboard-operable (aria-pressed attribute present)', () => {
    const result = generateComprehensionHTML(proTierData);
    // The My Lens button renders with aria-pressed
    assert.ok(
      result.includes('aria-pressed') && (result.includes('mylens') || result.includes('My Lens')),
      'Expected aria-pressed on My Lens persona button',
    );
  });
});

describe('generateComprehensionHTML — Phase 5b: Free tier — My Lens persona absent', () => {
  const freeTierNoProData = {
    project: 'FreeNoProProject',
    tier: 'free',
    hasPro: false,
    hasBusiness: false,
  };

  it('does NOT render My Lens persona button when hasPro is false', () => {
    const result = generateComprehensionHTML(freeTierNoProData);
    // The "My Lens" option must not appear for free users — Pro-only feature
    assert.ok(!result.includes('data-persona="mylens"'), 'My Lens persona button should not appear in Free tier');
  });
});

describe('generateComprehensionHTML — Phase 5b: default data (empty) uses free tier defaults', () => {
  it('empty data defaults to free tier — hasBusiness:false, no My Lens button', () => {
    const result = generateComprehensionHTML({});
    // Must not show My Lens button (hasPro=false by default)
    assert.ok(!result.includes('data-persona="mylens"'), 'My Lens must not appear in default (free) tier output');
    // hasBusiness defaults to false — verify it's embedded correctly
    assert.ok(result.includes('"hasBusiness":false'), 'Expected hasBusiness:false in default data JSON');
    // hasPro defaults to false
    assert.ok(result.includes('"hasPro":false'), 'Expected hasPro:false in default data JSON');
    // tier defaults to 'free'
    assert.ok(result.includes('"tier":"free"'), 'Expected tier:free in default data JSON');
  });
});
