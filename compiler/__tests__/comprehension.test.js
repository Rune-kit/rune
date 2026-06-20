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
