import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseOrgConfig } from '../parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUSINESS_DIR = path.resolve(__dirname, '../../../Business');
const ORG_TEMPLATES_DIR = path.join(BUSINESS_DIR, 'org-templates');
const SKILLS_DIR = path.resolve(__dirname, '../../skills');

// ─── parseOrgConfig unit tests ────────────────────────────────────

describe('parseOrgConfig', () => {
  const minimalTemplate = `---
name: test-org
description: Test organization template
version: "1.0.0"
tier: business
---

# Organization: Test Template

## Teams

| Team | Lead | Domain Packs | Members |
|------|------|-------------|---------|
| Engineering | CTO | — | eng-team |
| Product | VP Product | @rune-pro/product | product-team |

## Roles

| Role | Permissions | Approval Authority |
|------|------------|-------------------|
| admin | all | Can override any gate |
| contributor | write | Requires admin approval |

## Policies

### Code Review
- **Minimum reviewers**: 2
- **Self-merge allowed**: No

### Security
- **Dependency audit frequency**: Weekly
- **Secret rotation**: Monthly

### Deployment
- **Staging required**: Yes
- **Production deploy window**: Weekdays 09:00-16:00

## Approval Flows

### Feature Launch
\`\`\`
contributor proposes → admin approves → deploy
\`\`\`

### Budget Approval
\`\`\`
< $5,000: admin approves
> $5,000: board approves
\`\`\`

## Governance Level

**Moderate** — Balanced speed and safety.

- sentinel: enforce mode
- preflight: full checks
`;

  test('parses frontmatter correctly', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.strictEqual(result.name, 'test-org');
    assert.strictEqual(result.description, 'Test organization template');
    assert.strictEqual(result.version, '1.0.0');
    assert.strictEqual(result.tier, 'business');
  });

  test('parses teams table', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.strictEqual(result.teams.length, 2);
    assert.strictEqual(result.teams[0].team, 'Engineering');
    assert.strictEqual(result.teams[0].lead, 'CTO');
    assert.strictEqual(result.teams[1].team, 'Product');
    assert.strictEqual(result.teams[1].domain_packs, '@rune-pro/product');
  });

  test('parses roles table', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.strictEqual(result.roles.length, 2);
    assert.strictEqual(result.roles[0].role, 'admin');
    assert.strictEqual(result.roles[0].permissions, 'all');
    assert.strictEqual(result.roles[1].role, 'contributor');
  });

  test('parses policies into structured map', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.ok(result.policies.code_review, 'Expected code_review policy');
    assert.ok(result.policies.security, 'Expected security policy');
    assert.ok(result.policies.deployment, 'Expected deployment policy');

    const cr = result.policies.code_review;
    assert.strictEqual(cr.length, 2);
    assert.strictEqual(cr[0].key, 'minimum_reviewers');
    assert.strictEqual(cr[0].value, '2');
    assert.strictEqual(cr[1].key, 'self-merge_allowed');
    assert.strictEqual(cr[1].value, 'No');
  });

  test('parses security policies', () => {
    const result = parseOrgConfig(minimalTemplate);
    const sec = result.policies.security;
    assert.strictEqual(sec.length, 2);
    assert.strictEqual(sec[0].key, 'dependency_audit_frequency');
    assert.strictEqual(sec[0].value, 'Weekly');
    assert.strictEqual(sec[1].key, 'secret_rotation');
    assert.strictEqual(sec[1].value, 'Monthly');
  });

  test('parses deployment policies', () => {
    const result = parseOrgConfig(minimalTemplate);
    const dep = result.policies.deployment;
    assert.strictEqual(dep.length, 2);
    assert.strictEqual(dep[0].key, 'staging_required');
    assert.strictEqual(dep[0].value, 'Yes');
  });

  test('parses approval flows', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.ok(result.approvalFlows.feature_launch, 'Expected feature_launch flow');
    assert.ok(result.approvalFlows.budget_approval, 'Expected budget_approval flow');
    assert.ok(
      result.approvalFlows.feature_launch.includes('contributor proposes'),
      'Expected contributor proposes in feature launch flow',
    );
  });

  test('parses governance level', () => {
    const result = parseOrgConfig(minimalTemplate);
    assert.strictEqual(result.governanceLevel.level, 'moderate');
    assert.ok(result.governanceLevel.settings.length >= 2);
    assert.ok(result.governanceLevel.settings[0].includes('sentinel'));
  });

  test('handles missing sections gracefully', () => {
    const sparse = `---
name: sparse
---

# Sparse Org

## Teams

No table here.

## Governance Level

**Minimal** — Fast.

- basic checks
`;
    const result = parseOrgConfig(sparse);
    assert.strictEqual(result.name, 'sparse');
    assert.strictEqual(result.teams.length, 0);
    assert.strictEqual(result.roles.length, 0);
    assert.deepStrictEqual(result.policies, {});
    assert.deepStrictEqual(result.approvalFlows, {});
    assert.strictEqual(result.governanceLevel.level, 'minimal');
  });

  test('handles empty content', () => {
    const result = parseOrgConfig('');
    assert.strictEqual(result.name, '');
    assert.strictEqual(result.teams.length, 0);
    assert.strictEqual(result.roles.length, 0);
  });

  test('preserves filePath', () => {
    const result = parseOrgConfig(minimalTemplate, '/test/org.md');
    assert.strictEqual(result.filePath, '/test/org.md');
  });
});

// ─── Business org template file validation ────────────────────────

describe('Business org-templates file validation', () => {
  const templateFiles = [];

  if (existsSync(ORG_TEMPLATES_DIR)) {
    for (const file of readdirSync(ORG_TEMPLATES_DIR)) {
      if (file.endsWith('.md')) {
        templateFiles.push({
          name: file.replace('.md', ''),
          path: path.join(ORG_TEMPLATES_DIR, file),
        });
      }
    }
  }

  test('org-templates directory exists', () => {
    assert.ok(existsSync(ORG_TEMPLATES_DIR), 'Expected Business/org-templates/ to exist');
  });

  test('at least 3 org templates exist', () => {
    assert.ok(templateFiles.length >= 3, `Expected >= 3 templates, got ${templateFiles.length}`);
  });

  test('required templates exist (startup, mid-size, enterprise)', () => {
    const names = templateFiles.map((t) => t.name);
    assert.ok(names.includes('startup'), 'Missing startup template');
    assert.ok(names.includes('mid-size'), 'Missing mid-size template');
    assert.ok(names.includes('enterprise'), 'Missing enterprise template');
  });

  for (const template of templateFiles) {
    describe(`org-templates/${template.name}.md`, () => {
      const content = readFileSync(template.path, 'utf-8');
      const parsed = parseOrgConfig(content, template.path);

      test('has valid frontmatter with name', () => {
        assert.ok(parsed.name, 'Missing name in frontmatter');
        assert.strictEqual(parsed.name, template.name);
      });

      test('has description', () => {
        assert.ok(parsed.description, 'Missing description');
        assert.ok(parsed.description.length > 10, 'Description too short');
      });

      test('has version', () => {
        assert.ok(parsed.version, 'Missing version');
        assert.match(parsed.version, /^\d+\.\d+\.\d+$/, 'Version must be semver');
      });

      test('tier is business', () => {
        assert.strictEqual(parsed.tier, 'business');
      });

      test('has Teams section with entries', () => {
        assert.ok(parsed.teams.length > 0, 'Teams table is empty');
        for (const team of parsed.teams) {
          assert.ok(team.team, 'Team row missing team name');
          assert.ok(team.lead, 'Team row missing lead');
        }
      });

      test('has Roles section with entries', () => {
        assert.ok(parsed.roles.length > 0, 'Roles table is empty');
        for (const role of parsed.roles) {
          assert.ok(role.role, 'Role row missing role name');
          assert.ok(role.permissions, 'Role row missing permissions');
        }
      });

      test('has Policies section', () => {
        const policyKeys = Object.keys(parsed.policies);
        assert.ok(policyKeys.length > 0, 'No policies found');
        assert.ok(policyKeys.includes('code_review'), 'Missing Code Review policy');
        assert.ok(policyKeys.includes('security'), 'Missing Security policy');
      });

      test('has code review policy with minimum_reviewers', () => {
        const cr = parsed.policies.code_review;
        assert.ok(cr, 'Missing code_review policy');
        const minReviewers = cr.find((r) => r.key === 'minimum_reviewers');
        assert.ok(minReviewers, 'Missing minimum_reviewers in Code Review policy');
        const count = parseInt(minReviewers.value, 10);
        assert.ok(count >= 1, 'minimum_reviewers must be >= 1');
      });

      test('has security policy with dependency audit', () => {
        const sec = parsed.policies.security;
        assert.ok(sec, 'Missing security policy');
        const audit = sec.find((r) => r.key === 'dependency_audit_frequency');
        assert.ok(audit, 'Missing dependency_audit_frequency in Security policy');
      });

      test('has Approval Flows section', () => {
        const flowKeys = Object.keys(parsed.approvalFlows);
        assert.ok(flowKeys.length > 0, 'No approval flows found');
        assert.ok(flowKeys.includes('feature_launch'), 'Missing Feature Launch flow');
      });

      test('has valid governance level', () => {
        const validLevels = ['minimal', 'moderate', 'maximum'];
        assert.ok(
          validLevels.includes(parsed.governanceLevel.level),
          `Governance level '${parsed.governanceLevel.level}' not in [${validLevels.join(', ')}]`,
        );
      });

      test('governance settings reference sentinel', () => {
        const hasSentinel = parsed.governanceLevel.settings.some((s) =>
          s.toLowerCase().includes('sentinel'),
        );
        assert.ok(hasSentinel, 'Governance settings should reference sentinel mode');
      });

      test('## Governance Level section exists in body', () => {
        assert.ok(content.includes('## Governance Level'), 'Missing ## Governance Level heading');
      });

      test('references rune pack names correctly', () => {
        // All pack references should be @rune-pro/* or @rune-business/*
        const packRefs = content.match(/@rune-(?:pro|business)\/[\w-]+/g) || [];
        for (const ref of packRefs) {
          assert.match(
            ref,
            /^@rune-(pro|business)\/[a-z][\w-]*$/,
            `Invalid pack reference: ${ref}`,
          );
        }
      });
    });
  }
});

// ─── Governance level scaling tests ───────────────────────────────

describe('org template governance scaling', () => {
  if (!existsSync(ORG_TEMPLATES_DIR)) return;

  const templateData = {};
  for (const name of ['startup', 'mid-size', 'enterprise']) {
    const filePath = path.join(ORG_TEMPLATES_DIR, `${name}.md`);
    if (existsSync(filePath)) {
      templateData[name] = parseOrgConfig(readFileSync(filePath, 'utf-8'), filePath);
    }
  }

  test('startup has minimal governance', () => {
    assert.ok(templateData.startup, 'Missing startup template');
    assert.strictEqual(templateData.startup.governanceLevel.level, 'minimal');
  });

  test('mid-size has moderate governance', () => {
    assert.ok(templateData['mid-size'], 'Missing mid-size template');
    assert.strictEqual(templateData['mid-size'].governanceLevel.level, 'moderate');
  });

  test('enterprise has maximum governance', () => {
    assert.ok(templateData.enterprise, 'Missing enterprise template');
    assert.strictEqual(templateData.enterprise.governanceLevel.level, 'maximum');
  });

  test('team count scales: startup < mid-size < enterprise', () => {
    const s = templateData.startup?.teams.length || 0;
    const m = templateData['mid-size']?.teams.length || 0;
    const e = templateData.enterprise?.teams.length || 0;
    assert.ok(s < m, `startup teams (${s}) should be < mid-size (${m})`);
    assert.ok(m <= e, `mid-size teams (${m}) should be <= enterprise (${e})`);
  });

  test('role count scales: startup < mid-size < enterprise', () => {
    const s = templateData.startup?.roles.length || 0;
    const m = templateData['mid-size']?.roles.length || 0;
    const e = templateData.enterprise?.roles.length || 0;
    assert.ok(s < m, `startup roles (${s}) should be < mid-size (${m})`);
    assert.ok(m <= e, `mid-size roles (${m}) should be <= enterprise (${e})`);
  });

  test('startup minimum_reviewers <= mid-size <= enterprise', () => {
    const getMinReviewers = (data) => {
      const cr = data?.policies.code_review;
      if (!cr) return 0;
      const r = cr.find((x) => x.key === 'minimum_reviewers');
      return r ? parseInt(r.value, 10) : 0;
    };
    const s = getMinReviewers(templateData.startup);
    const m = getMinReviewers(templateData['mid-size']);
    const e = getMinReviewers(templateData.enterprise);
    assert.ok(s <= m, `startup reviewers (${s}) should be <= mid-size (${m})`);
    assert.ok(m <= e, `mid-size reviewers (${m}) should be <= enterprise (${e})`);
  });

  test('enterprise has more policy categories than startup', () => {
    const sKeys = Object.keys(templateData.startup?.policies || {}).length;
    const eKeys = Object.keys(templateData.enterprise?.policies || {}).length;
    assert.ok(eKeys >= sKeys, `enterprise policies (${eKeys}) should be >= startup (${sKeys})`);
  });

  test('enterprise has more approval flows than startup', () => {
    const sFlows = Object.keys(templateData.startup?.approvalFlows || {}).length;
    const eFlows = Object.keys(templateData.enterprise?.approvalFlows || {}).length;
    assert.ok(eFlows >= sFlows, `enterprise flows (${eFlows}) should be >= startup (${sFlows})`);
  });

  test('enterprise governance settings are more comprehensive', () => {
    const sSettings = templateData.startup?.governanceLevel.settings.length || 0;
    const eSettings = templateData.enterprise?.governanceLevel.settings.length || 0;
    assert.ok(
      eSettings >= sSettings,
      `enterprise settings (${eSettings}) should be >= startup (${sSettings})`,
    );
  });
});

// ─── Sentinel + preflight org integration ─────────────────────────

describe('sentinel/preflight org policy integration', () => {
  const sentinelPath = path.join(SKILLS_DIR, 'sentinel', 'SKILL.md');
  const preflightPath = path.join(SKILLS_DIR, 'preflight', 'SKILL.md');

  test('sentinel references .rune/org/org.md', () => {
    const content = readFileSync(sentinelPath, 'utf-8');
    assert.ok(
      content.includes('.rune/org/org.md'),
      'sentinel should reference .rune/org/org.md for org policy loading',
    );
  });

  test('sentinel has Organization Policy Enforcement step', () => {
    const content = readFileSync(sentinelPath, 'utf-8');
    assert.ok(
      content.includes('Organization Policy Enforcement'),
      'sentinel should have Organization Policy Enforcement step',
    );
  });

  test('sentinel handles missing org config gracefully', () => {
    const content = readFileSync(sentinelPath, 'utf-8');
    assert.ok(
      content.includes('no org config'),
      'sentinel should handle missing org config',
    );
  });

  test('preflight references .rune/org/org.md', () => {
    const content = readFileSync(preflightPath, 'utf-8');
    assert.ok(
      content.includes('.rune/org/org.md'),
      'preflight should reference .rune/org/org.md for org requirements',
    );
  });

  test('preflight has Organization Approval Requirements step', () => {
    const content = readFileSync(preflightPath, 'utf-8');
    assert.ok(
      content.includes('Organization Approval Requirements'),
      'preflight should have Organization Approval Requirements step',
    );
  });

  test('preflight handles missing org config gracefully', () => {
    const content = readFileSync(preflightPath, 'utf-8');
    assert.ok(
      content.includes('no org config'),
      'preflight should handle missing org config',
    );
  });

  test('sentinel step is numbered 4.86 (between contract 4.85 and six-gate 4.9)', () => {
    const content = readFileSync(sentinelPath, 'utf-8');
    assert.ok(
      content.includes('Step 4.86'),
      'sentinel org policy step should be numbered 4.86',
    );
  });

  test('preflight step is numbered 4.6 (between domain hooks 4.5 and composite score 4.8)', () => {
    const content = readFileSync(preflightPath, 'utf-8');
    assert.ok(
      content.includes('Step 4.6'),
      'preflight org requirements step should be numbered 4.6',
    );
  });
});
