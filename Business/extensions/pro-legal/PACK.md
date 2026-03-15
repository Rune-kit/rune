---
name: "@rune-pro/legal"
description: Legal operations intelligence — contract review, compliance checking, policy generation, NDA triage, IP protection, and incident legal response. Catches the contract clauses, compliance gaps, and IP risks that cost startups $50K–$500K when discovered at due diligence.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$149 lifetime (Business tier)"
  target: Founders, COOs, legal counsel, and operations managers who handle legal operations at startups and SMBs without dedicated legal teams
---

# @rune-pro/legal

## Purpose

Legal failures at startups are silent and cumulative: auto-renewal clauses that lock $120K/year vendor contracts because nobody tracked the 60-day notice window, IP indemnity carve-outs that make a "capped" liability clause effectively unlimited, privacy policies that describe data practices the product doesn't actually follow, NDAs with residuals clauses that let the counterparty legally walk away with trade secrets in their employees' memories, AGPL dependencies buried three levels deep in the dependency tree that force open-sourcing the entire application at acquisition due diligence, and breach notification deadlines missed because the incident response plan existed on paper but was never drilled. Each failure is invisible until it becomes a $50K-$500K line item in a legal bill, a killed deal, or a regulatory fine.

This pack gives a coding AI assistant the legal operations layer that catches these failures before they compound. Every skill writes to a predictable location under `.rune/legal/` or `docs/policies/` so every artifact is versioned, auditable, and discoverable by the next person who needs it. The pack reads from `.rune/business/context.md` for company stage, industry, and geographic footprint — meaning once the context is seeded, every compliance check, contract review, and policy draft is tailored to the company's actual regulatory exposure without additional prompting.

The six skills form a defense-in-depth chain: `contract-review` catches dangerous terms before signing, `compliance-check` maps regulatory exposure and evidence gaps, `policy-generator` produces the documentation that compliance requires, `nda-triage` protects trade secrets during business development, `ip-protection` audits the codebase and contributor chain for ownership gaps, and `incident-legal` activates when something goes wrong to preserve evidence, meet notification deadlines, and protect legal privilege.

## Triggers

- Auto-trigger: when `.rune/business/context.md` exists with industry or geographic information
- Auto-trigger: when `.rune/legal/` directory exists (past legal artifacts detected)
- Auto-trigger: when `docs/policies/` directory exists
- `/rune legal` — manual invocation of the full pack
- `/rune legal contract-review` — single skill invocation
- Called by `cook` (L1) when contract review, compliance, or legal context detected
- Called by `team` (L1) when a legal specialist subagent is needed
- Called by `incident` (L2 free) when legal exposure assessment is needed during an incident
- Called by `@rune-pro/finance.compliance-reporting` for shared regulatory requirements (SOX↔GDPR overlap)

## Workflows

| Command | What It Does | Skills Used |
|---------|-------------|-------------|
| `/rune legal vendor-review <contract>` | Full contract review with risk scoring and redline suggestions | contract-review |
| `/rune legal compliance-audit` | Map regulatory exposure, check evidence gaps, generate remediation plan | compliance-check → policy-generator |
| `/rune legal nda-review <file>` | Triage NDA — score risk, flag residuals/carve-outs, recommend edits | nda-triage |
| `/rune legal ip-audit` | Full codebase IP audit — licenses, contributors, assignment gaps | ip-protection |
| `/rune legal incident-response` | Activate incident legal playbook — preserve evidence, assess notification deadlines | incident-legal → compliance-check |
| `/rune legal due-diligence-prep` | Generate M&A/fundraise legal readiness report | All 6 skills |

### Open Source License Compatibility Matrix

Quick-reference for `ip-protection` skill. Determines whether combining code under different licenses creates legal obligations.

```
                  MIT    Apache-2.0   BSD-3   MPL-2.0   LGPL-2.1   GPL-2.0   GPL-3.0   AGPL-3.0
MIT               ✅      ✅          ✅       ✅         ✅          ⚠️         ⚠️         ⚠️
Apache-2.0        ✅      ✅          ✅       ✅         ✅          ❌         ⚠️         ⚠️
BSD-3             ✅      ✅          ✅       ✅         ✅          ⚠️         ⚠️         ⚠️
MPL-2.0           ✅      ✅          ✅       ✅         ✅          ⚠️         ⚠️         ⚠️
LGPL-2.1          ✅      ✅          ✅       ✅         ✅          ✅          ⚠️         ⚠️
GPL-2.0           ⚠️     ❌          ⚠️       ⚠️         ✅          ✅          ❌         ❌
GPL-3.0           ⚠️     ⚠️          ⚠️       ⚠️         ⚠️          ❌         ✅          ❌
AGPL-3.0          ⚠️     ⚠️          ⚠️       ⚠️         ⚠️          ❌         ❌          ✅

✅ = Compatible (can combine freely)
⚠️ = Conditional (combined work inherits copyleft obligations — review before shipping)
❌ = Incompatible (cannot combine in same binary/service without violating one license)
```

**Critical rules**:
- **AGPL-3.0**: Network copyleft — if your SaaS uses AGPL code, users who access your service over a network can demand your source code. This applies even if the AGPL library is 3 levels deep in `node_modules`. Acquirers run license audits and AGPL = deal blocker or $200K+ remediation.
- **GPL-2.0 vs GPL-3.0**: NOT compatible with each other. A project cannot combine GPL-2.0-only code with GPL-3.0 code.
- **Apache-2.0 + GPL-2.0**: Incompatible due to patent termination clause conflict. Apache-2.0 works with GPL-3.0 but not GPL-2.0.
- **"MIT-like" isn't MIT**: Some licenses say "do whatever you want" but add a non-standard clause (e.g., no-military-use, ethical-source). These are NOT OSI-approved and create unpredictable obligations.

### M&A / Fundraise Legal Readiness Checklist

When `/rune legal due-diligence-prep` is invoked, the pack validates legal artifacts acquirers and investors expect:

```
## Legal Due Diligence — Minimum Viable Artifacts
- [ ] Certificate of Incorporation + all amendments (Delaware preferred)
- [ ] Bylaws (current, board-approved)
- [ ] Board minutes for all material decisions (fundraise, option grants, pivots)
- [ ] Cap table reconciled with legal docs (fully diluted, including SAFEs/convertibles)
- [ ] IP assignment agreements for ALL founders, employees, and contractors
- [ ] Proprietary Information and Invention Assignment (PIIA) signed by all team members
- [ ] Customer contracts (top 10 by ARR) with key terms summary
- [ ] Vendor contracts with auto-renewal dates and termination notice periods
- [ ] Privacy policy + ToS that match actual product data practices
- [ ] Open source license audit — no AGPL/GPL contamination in proprietary code
- [ ] Patent portfolio (if any) with prosecution status
- [ ] Trademark registrations (or evidence of common-law rights)
- [ ] Pending or threatened litigation disclosure
- [ ] Employment agreements with non-compete/non-solicit terms (enforceability varies by state)
- [ ] Insurance policies (D&O, E&O, cyber liability) with coverage amounts
```

**Common due diligence failures** (any one can kill or delay a deal 2-6 months):
- Missing IP assignment from a contractor who wrote 30% of the codebase → ownership dispute
- Cap table shows 10M shares issued but legal docs show 12M → triggers full legal reconciliation
- Privacy policy says "we never sell data" but ad SDK sends data to 14 third parties → regulatory exposure
- Employee in California has non-compete clause → unenforceable, signals legal naïveté to acquirer

## Business Context Setup

Before activating any skill, populate `.rune/business/` with the company's legal context. This directory is the single source of truth that all six skills read from.

### Required Files

**`.rune/business/context.md`** — Company context (shared with other pro packs):
```markdown
# Company Context

## Legal Entity
- **Name**: [Legal entity name]
- **Jurisdiction**: [State of incorporation — usually Delaware]
- **Formation date**: [YYYY-MM-DD — important for pre-incorporation IP audit]
- **Stage**: Seed / Series A / Series B / Growth / Pre-IPO

## Industry & Data
- **Industry**: [SaaS / Fintech / Healthcare / E-commerce / etc.]
- **Handles PII**: Yes/No
- **Handles PHI**: Yes/No (triggers HIPAA requirements)
- **Handles financial data**: Yes/No (triggers SOX/PCI requirements)
- **EU customers**: Yes/No (triggers GDPR)
- **CA customers/employees**: Yes/No (triggers CCPA/CPRA)

## Geographic Footprint
- **HQ**: [City, State, Country]
- **Employee states**: [CA, NY, TX, etc. — each has different employment law]
- **Customer regions**: [US, EU, UK, APAC — each has different privacy law]
- **Remote workforce**: Yes/No (multi-state compliance implications)
```

**`.rune/business/processes.md`** — Legal processes and approval chains:
```markdown
# Legal Processes

## Contract Approval Thresholds
- < $10K total value: Manager + legal template (no custom review)
- $10K - $50K: Legal review required (standard turnaround: 3 business days)
- $50K - $250K: Legal review + CFO approval
- > $250K: Legal review + CFO + CEO approval
- Customer-paper MSA (any value): Legal review mandatory

## NDA Policy
- Outbound (our paper): Use standard mutual NDA template
- Inbound (their paper): Legal review required — flag residuals clauses, non-standard terms
- Duration: Minimum 2 years; 3-5 years for trade secret disclosures

## Vendor Contracts
- Auto-renewal tracking: Legal maintains renewal calendar
- Notice period: Flag any contract with >30-day cancellation notice window
- IP indemnity: Must be capped; uncapped IP indemnity requires CEO approval

## Incident Response
- Legal contact: [Name, email, phone]
- Outside counsel: [Firm name, contact]
- Cyber insurance carrier: [Name, policy #, notification deadline]
- IR firm (through counsel): [Firm name — engaged through outside counsel to preserve privilege]
```

---

## Skills

### 1. `contract-review`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash

**Purpose**: Review contracts for dangerous terms, hidden traps, and asymmetric provisions — focusing on the clauses that cost startups $50K-$500K when discovered at due diligence or enforcement.

**When to use**: Before signing any vendor contract, customer MSA, partnership agreement, or SaaS subscription. Especially critical for: customer-paper MSAs (their terms, not yours), contracts >$50K total value, and any contract with auto-renewal.

**Steps**:

1. **Identify contract type and parties** — Classify: SaaS subscription, professional services SOW, customer MSA, vendor agreement, partnership/channel, licensing. Determine which party is in the stronger negotiating position — this affects which clauses are redline-worthy vs. accept-and-move-on.

2. **Extract key commercial terms** — Build a term sheet summary:
   - Total value and payment schedule
   - Term length and renewal mechanism
   - Termination provisions (for cause, for convenience, notice period)
   - SLA commitments and remedies for breach
   - Pricing escalation or adjustment clauses

3. **Auto-renewal trap detection** — The #1 contract gotcha for startups:
   - Flag notice window length: >30 days is aggressive; >60 days is a trap
   - Calculate notice deadline: contract end date minus notice period = last day to cancel
   - Flag if renewal term equals initial term (not month-to-month after initial)
   - 60% of supplier contracts auto-renew without buyer knowledge. A $120K/year deal with a 60-day notice window locks the startup for another full year if the window is missed.
   - **Action**: Add every auto-renewal deadline to `.rune/legal/calendar.md`

4. **Liability analysis** — The clause that determines maximum financial exposure:
   - Extract liability cap amount and basis ("fees paid in last 12 months" is standard)
   - **Inventory ALL carve-outs to the cap**: IP indemnification is almost universally carved out, making it effectively unlimited. A $10K/month contract with an IP indemnity carve-out has a $120K cap on general damages but unlimited IP exposure.
   - Flag uncapped indemnification obligations
   - Check indemnity directionality: mutual obligations should have mutual triggers. Flag one-sided indemnity or mutual language with asymmetric trigger conditions ("to the extent caused by Vendor's breach" on one side, unconditional on the other).
   - Check insurance requirements: does the contract require insurance that the startup doesn't carry?

5. **IP and data provisions** — Critical for SaaS companies:
   - Who owns work product / deliverables?
   - Is there an IP assignment or license-back provision?
   - Data ownership: does the vendor claim rights to customer data for ML training, benchmarking, or "aggregate" analytics?
   - Non-compete / non-solicit clauses: scope, duration, geography
   - Source code escrow requirements (enterprise customers sometimes demand this)

6. **Termination asymmetry check** — Flag if:
   - Only one party has termination for convenience
   - Cure periods are asymmetric (customer gets 30 days to cure breach, vendor gets 0)
   - Post-termination obligations are one-sided (data return vs. data destruction)
   - Change of control clause exists (agreement terminates if startup is acquired — M&A deal killer)

7. **"Efforts" qualifier audit** — These words have specific legal meaning:
   - "Best efforts" = do everything reasonably possible, potentially at a loss
   - "Commercially reasonable efforts" = what a reasonable business would do (lower standard)
   - "Reasonable efforts" = similar to commercially reasonable but jurisdiction-dependent
   - Flag any obligation using "best efforts" — this is the highest standard and should be avoided as the performing party

8. **Generate review artifact** — Write to `.rune/legal/reviews/<contract-name>.md`:
   ```markdown
   # Contract Review: <Contract Name>

   ## Parties
   - **Us**: [Entity name] (as [Vendor/Customer/Partner])
   - **Counterparty**: [Entity name]

   ## Summary
   | Term | Value |
   |------|-------|
   | Type | [MSA/SOW/SaaS/etc.] |
   | Total Value | $X |
   | Term | X months/years |
   | Auto-Renewal | Yes/No — Notice: X days before [date] |
   | Liability Cap | $X (carve-outs: [list]) |
   | Governing Law | [State] |

   ## Risk Assessment: [LOW / MEDIUM / HIGH / CRITICAL]

   ## Flags
   | # | Clause | Risk | Issue | Recommendation |
   |---|--------|------|-------|----------------|

   ## Redline Suggestions
   | Section | Current Language | Proposed Change | Priority |

   ## Calendar Items
   | Date | Action Required | Contract Reference |
   ```

**Sharp edges**:
- "Fees paid in last 12 months" liability cap with IP carve-out: looks protective but IP indemnity exposure is unlimited. A $100K judgment + $1M in customer's lost revenue = $1.1M liability on a $10K/month contract.
- "Governing law: Delaware" — fine for corp matters, but if the customer is in CA, CA consumer protection and auto-renewal statutes may still apply.
- "Mutual indemnity" with asymmetric triggers: grammatically mutual but functionally one-sided.
- Limitation of liability "excluding gross negligence" — courts define gross negligence broadly; this exclusion can swallow the entire cap.
- SOW language like "deliver a scalable solution" or "reasonable efforts" with no acceptance criteria = customer can indefinitely reject delivery.

---

### 2. `compliance-check`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Map regulatory exposure based on company profile, identify evidence gaps, and produce audit-ready compliance artifacts — because the gap between "we think we're compliant" and "we can prove we're compliant" is where fines and failed due diligence live.

**When to use**: Pre-fundraise due diligence prep, annual compliance review, new market expansion (adding EU customers triggers GDPR), SOC2/HIPAA readiness assessment, or after a regulation change.

**Steps**:

1. **Build regulatory map** — Based on `.rune/business/context.md`, determine which regulations apply:
   | Trigger | Regulation | Key Requirement |
   |---------|-----------|-----------------|
   | Any PII | State privacy laws (50 states) | Breach notification |
   | EU customers/employees | GDPR | Consent, DPA, 72h breach notification |
   | CA customers/employees | CCPA/CPRA | Opt-out, data deletion, retention periods |
   | Health data (PHI) | HIPAA | BAA, access controls, breach notification 60d |
   | Payment processing | PCI DSS | SAQ level, secure card handling |
   | Pre-IPO / Series B+ | SOX-equivalent | Internal controls, segregation of duties |
   | SaaS enterprise sales | SOC 2 Type II | Trust service criteria audit |
   | Financial data | SOX, GLBA | Reporting controls, data safeguards |

2. **Data flow mapping** — Trace where regulated data lives:
   - **Collection points**: signup forms, payment pages, API integrations
   - **Processing**: which services touch the data (app servers, analytics, logging)
   - **Storage**: databases, backups, cold storage, log aggregators
   - **Third parties**: every SaaS tool that receives regulated data is a subprocessor
   - **Critical check**: Does Sentry capture stack traces with PII/PHI? Does Mixpanel capture user actions with PHI? Does DataDog log request bodies? These are subprocessor relationships that require DPAs/BAAs.

3. **Consent mechanism audit** — Check if consent flows actually work:
   - Do cookie banners honor Global Privacy Control (GPC) signals? 75% of websites don't — the CPPA fined Tractor Supply $1.35M specifically for this.
   - Are pre-checked boxes used for marketing consent? (GDPR violation)
   - Does the "Do Not Sell" opt-out actually disconnect ad tech trackers, or just submit a webform? (CCPA violation if webform-only)
   - Is consent bundled (marketing + analytics + functional in one checkbox)? Must be granular under GDPR.

4. **BAA/DPA inventory** — For every cloud service touching regulated data:
   - Check if a signed BAA exists (HIPAA) or DPA exists (GDPR)
   - Flag services added by engineering without legal review (common: monitoring tools, error trackers, analytics)
   - Cross-reference `package.json` / infrastructure config against known PHI-adjacent services
   - SOC 2 ≠ HIPAA: a vendor's SOC 2 Type II report does NOT satisfy the BAA requirement. North Memorial Health Care paid $1.55M for sharing PHI with a business associate without a BAA.

5. **Privacy policy cross-check** — Compare stated practices against actual practices:
   - Does the privacy policy list specific data retention periods? CCPA/CPRA requires timeframes, not "as long as necessary."
   - Does the privacy policy describe data categories that the product actually collects? FTC Section 5 (deceptive practices) applies when actual practices don't match stated policy — even without a breach.
   - Are third-party tracking scripts (GA4, Meta Pixel, HubSpot) disclosed in the privacy policy?

6. **Evidence completeness assessment** — Score audit readiness:
   - Consent records: can you prove when each user consented and to what?
   - Data Subject Access Requests (DSAR): can you retrieve all data for a specific user within 30 days?
   - Breach notification records: do you have a documented process?
   - Vendor DPA/BAA registry: are all subprocessors documented?
   - Data retention implementation: does the code actually delete data per the stated policy?

7. **Generate compliance report** — Write to `.rune/legal/compliance/<regulation>.md`:
   ```markdown
   # Compliance Report: <Regulation>

   ## Status: [COMPLIANT / GAPS DETECTED / CRITICAL GAPS]

   ## Applicability
   | Trigger | Present | Regulation | Impact |

   ## Data Flow Map
   | Data Type | Collection | Processing | Storage | Third Parties | DPA/BAA |

   ## Consent Audit
   | Mechanism | Status | Issue | Remediation |

   ## Evidence Matrix
   | Requirement | Evidence Required | Available | Gap | Risk | Remediation |

   ## Subprocessor Registry
   | Service | Data Touched | DPA/BAA Signed | Expiry | Contact |

   ## Compliance Score: X/100
   - Regulatory coverage: X%
   - Evidence completeness: X%
   - Consent mechanism validity: X%

   ## Priority Remediation
   | # | Gap | Regulation | Risk (Fine) | Owner | Deadline |
   ```

**Sharp edges**:
- "We don't sell data" — CCPA defines "sell" to include sharing for cross-context behavioral advertising even without money changing hands. If you use Meta Pixel or Google Analytics with advertising features, you may be "selling" data under CCPA.
- "Anonymized" data — GDPR and CCPA consider pseudonymized data (reversible with a key) as personal data. Only truly irreversible anonymization is out of scope. Hashing an email is pseudonymization, not anonymization.
- SOC 2 Type II satisfies enterprise security questionnaires but does NOT satisfy HIPAA. They test different things.
- GPC signals — required to honor under CCPA since 2022. Most consent management platforms handle cookie consent but not GPC browser headers.
- Average GDPR fine in 2024: €2.8M (up 30% YoY). CCPA: $7,500 per intentional violation with no cap.

---

### 3. `policy-generator`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash

**Purpose**: Generate legally-structured policies that match the company's actual practices — because template policies copied from competitors are FTC Section 5 violations waiting to happen.

**When to use**: First privacy policy, Terms of Service update, employee handbook creation, new compliance requirement (adding GDPR means updating privacy policy), or when existing policies haven't been reviewed in >12 months.

**Steps**:

1. **Identify policy need** — Determine which policy is needed based on trigger:
   - **Privacy Policy**: Required by law if collecting any PII. Must match actual data practices.
   - **Terms of Service**: Governs the product relationship. Must match actual product capabilities.
   - **Acceptable Use Policy**: Defines prohibited behavior. Required for user-generated content platforms.
   - **Data Retention Policy**: Internal policy defining how long each data category is kept. CCPA/CPRA requires specific timeframes disclosed externally.
   - **Incident Response Policy**: Internal runbook for breach response. Required for SOC2, recommended for all.
   - **Employee Handbook**: Employment policies. Must be jurisdiction-aware for multi-state workforces.

2. **Audit current state** — Before writing, understand what the company actually does:
   - What data does the product collect? (Scan codebase/config for tracking SDKs, analytics, form fields)
   - What third parties receive data? (Subprocessor list)
   - How long is data retained? (Check database TTLs, log retention settings, backup policies)
   - What user controls exist? (Account deletion, data export, consent management)
   - **Critical**: The policy must describe what the company DOES, not what it SHOULD do. A policy claiming "we delete data after 90 days" when data is kept indefinitely is worse than no policy — it's evidence of deception.

3. **Draft policy with required sections** — Each policy type has mandatory sections:

   **Privacy Policy minimum sections**:
   - Information collected (categories + specific items)
   - How information is used (purposes, legal basis under GDPR)
   - Information shared with third parties (categories of recipients)
   - Data retention periods (specific timeframes per CCPA/CPRA)
   - User rights (access, deletion, opt-out, portability)
   - Contact information for privacy requests
   - Children's data (COPPA compliance if applicable)
   - International transfers (if data leaves the country)

   **Employee Handbook critical sections**:
   - At-will employment statement (if applicable by state)
   - Anti-discrimination and harassment policies
   - Leave policies (must comply with state-specific requirements: CA, NY, MA all differ)
   - Remote work policy (if multi-state: address each state's specific requirements)
   - IP assignment clause (MUST carve out pre-existing IP and personal side projects per CA Labor Code § 2870)

4. **Check for legal contradictions** — Common mistakes:
   - Handbook says "at-will" AND describes multi-step PIP process → courts have found this creates implied contractual obligation for PIP before termination
   - Arbitration clause embedded in handbook body alongside "this is not a contract" disclaimer → courts (4th Circuit, *Coady v. Nationwide*) have struck these down as illusory. Arbitration must be a separate signed document.
   - Non-disparagement clauses in severance → NLRB (2023, *McLaren Macomb*) ruled overly broad non-disparagement violates NLRA Section 7 rights
   - Non-compete clauses → Void and unenforceable in CA, MN, ND, OK. Many other states limiting scope. Don't rely on non-competes for IP protection.

5. **Multi-state compliance check** — If employees are in multiple states:
   - CA: no non-competes, mandatory paid sick leave, salary transparency on job postings, IP carve-out required in employment agreements
   - NY: salary transparency laws, specific harassment training requirements
   - CO: equal pay transparency, specific leave requirements
   - WA: non-compete threshold ($116K+ salary in 2024), specific leave requirements
   - Flag if handbook uses one-size-fits-all language for state-specific requirements

6. **Review and version control** — Every policy must include:
   - Effective date
   - Last reviewed date
   - Version number
   - Change summary from prior version
   - Approval chain (who reviewed and approved)

7. **Generate policy** — Write to `docs/policies/<policy-name>.md`:
   ```markdown
   # <Policy Name>

   **Effective Date**: YYYY-MM-DD
   **Last Reviewed**: YYYY-MM-DD
   **Version**: X.Y
   **Approved By**: [Name, Title]

   ## Purpose
   [Why this policy exists — 2-3 sentences]

   ## Scope
   [Who and what this policy applies to]

   ## Definitions
   [Key terms defined — critical for enforceability]

   ## Policy Statements
   [Numbered, specific, actionable statements]

   ## Enforcement
   [What happens if the policy is violated]

   ## Review Schedule
   [When this policy will be reviewed — minimum annually]

   ## Change History
   | Version | Date | Changes | Approved By |
   ```

**Sharp edges**:
- Copy-paste privacy policies from competitors describe THEIR data practices, not yours. FTC Section 5 deceptive practices applies when actual practices don't match stated policy — even without a breach.
- "Effective upon continued use" for ToS updates — may not constitute valid consent under GDPR for EU users or some US state laws. Material changes may require affirmative re-consent.
- IP ownership clause in offer letter that says "all inventions" — too broad. CA Labor Code § 2870 exempts inventions on employee's own time, without company resources, unrelated to company's business. An overbroad clause makes the entire IP agreement legally questionable.
- Non-compete reliance: a startup depending on non-competes for IP protection (instead of proper trade secret protocols + NDAs) is exposed in every state that voids non-competes.

---

### 4. `nda-triage`

**Model**: haiku
**Tools**: Read, Write, Edit, Bash

**Purpose**: Quickly classify NDAs, flag dangerous provisions (especially residuals clauses), and recommend accept/negotiate/reject — because BD teams sign NDAs in the field without legal review and the wrong NDA can permanently destroy trade secret protection.

**When to use**: Before signing any NDA, before a due diligence process, before disclosing proprietary information to a potential partner/vendor/acquirer, or when reviewing an inbound NDA from a counterparty.

**Steps**:

1. **Classify NDA structure** — Determine directionality:
   - **Mutual**: Both parties disclose and protect. Appropriate for: joint development, partnership exploration, mutual due diligence.
   - **Unilateral (us protecting)**: We disclose, they protect. Appropriate for: vendor evaluation, one-way demo, investor pitch.
   - **Unilateral (them protecting)**: They disclose, we protect. Appropriate for: receiving their API docs, accessing their platform.
   - **Flag mismatch**: If the relationship involves mutual disclosure but the NDA is unilateral, the disclosing party's information is unprotected. If the startup is the only discloser but signs a mutual NDA, it creates unnecessary obligations to protect the counterparty's "confidential" information.

2. **Residuals clause detection** — The silent IP theft provision:
   - Search for: "residuals," "unaided memory," "retained in memory," "general skills and knowledge," "intangible information retained"
   - A residuals clause allows the receiving party's employees to freely use information retained in their unaided memory — legally sanctioned trade secret extraction.
   - Present in ~2% of NDAs, overwhelmingly from large tech companies (Microsoft, Google, Oracle).
   - **Recommendation**: REJECT any NDA with a residuals clause when disclosing core trade secrets. Negotiate removal or narrow the scope to exclude trade secrets.

3. **Duration and survival check** — Protect trade secret status:
   - Duration <2 years for an ongoing relationship → flag. Under the Uniform Trade Secrets Act, trade secret protection requires ongoing reasonable efforts to maintain secrecy. An expired NDA during active disclosure creates a window where information is unprotected — courts have found this destroys trade secret status permanently.
   - Confidentiality obligations should survive termination for at least 2-3 years (5 years for trade secrets).
   - Flag NDAs with no survival clause (confidentiality ends at termination).

4. **Signatory authority check** — Verify the NDA is enforceable:
   - Is the signatory authorized to bind the corporate entity? Look for: "as authorized representative of [Company]," officer title, or reference to signing authority.
   - Flag individuals signing without clear corporate agency. Real case (*Protégé v. Z-Medica*): NDA signed by an individual who wasn't the company's agent — company incorporated confidential information into a patent and the NDA was unenforceable.

5. **Standard carve-out inventory** — Every enforceable NDA must include these exclusions:
   - Information already in the public domain
   - Information independently developed without use of confidential information
   - Information received from a third party without restriction
   - Information required to be disclosed by law/court order (with notice requirement)
   - **Flag if any standard carve-out is missing** — it makes the NDA overbroad and potentially unenforceable.

6. **Generate triage report** — Write to `.rune/legal/nda/<counterparty>.md`:
   ```markdown
   # NDA Triage: <Counterparty>

   ## Classification
   | Field | Value |
   |-------|-------|
   | Type | Mutual / Unilateral |
   | Direction Match | ✅ Correct / ⚠️ Mismatch |
   | Duration | X years |
   | Survival | X years post-termination |
   | Governing Law | [State] |

   ## Risk Assessment: [ACCEPT / NEGOTIATE / REJECT]

   ## Flags
   | # | Provision | Risk | Issue | Recommendation |
   |---|-----------|------|-------|----------------|

   ## Residuals Clause: [NONE / DETECTED — location: Section X]

   ## Carve-Out Checklist
   - [x] Public domain exclusion
   - [x] Independent development exclusion
   - [x] Third-party receipt exclusion
   - [x] Legal compulsion exclusion (with notice)

   ## Signatory
   | Name | Title | Authority Confirmed |

   ## Calendar Items
   | Date | Action | Note |
   ```

**Sharp edges**:
- "Confidential" stamp requirement: NDAs requiring oral disclosures to be confirmed in writing within 30 days routinely result in trade secret loss because follow-up letters are never sent. Negotiate to remove or extend to 90 days.
- Overbroad "all information disclosed" definition: NDAs that define everything as confidential often protect nothing — courts interpret overbroad definitions skeptically. Categories-based definitions (trade secrets, technical specifications, business plans, customer lists) are more enforceable.
- NDA in LOI context: parties execute NDA as part of a term sheet/LOI, but the LOI itself (if signed first) may have already disclosed the key terms being "protected."
- Employee attendee coverage: Engineers attend technical due diligence meetings and make verbal disclosures — but the NDA may not cover individual attendees who aren't signatories.

---

### 5. `ip-protection`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Audit the codebase and contributor chain for IP ownership gaps, license contamination, and trademark exposure — because GPL in the dependency tree and missing contractor IP assignments kill M&A deals.

**When to use**: Pre-fundraise due diligence prep, pre-acquisition IP audit, when adding open-source dependencies, when onboarding contractors, annually, or when an acquirer's counsel requests an IP audit.

**Steps**:

1. **Dependency license scan** — Walk the full dependency tree:
   - Parse `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`
   - Classify each dependency by license: MIT, Apache 2.0, BSD, ISC (permissive — low risk), LGPL (medium risk — dynamic linking required), GPL/AGPL/EUPL/CCEL (high risk — copyleft, requires human review)
   - **AGPL is the M&A killer**: If the application uses an AGPL library (even as a transitive dependency) and runs as a network service, the ENTIRE application must be made open-source. 22% of open-source code carries copyleft risk. Fortinet was injuncted by Munich court for concealing GPL use with cryptography.
   - Check transitive dependencies (dependency of a dependency) — AGPL contamination is often 3-4 levels deep.
   - **LGPL gotcha**: LGPL allows use in proprietary software IF dynamically linked and users can swap the library. Static linking triggers copyleft. Many build systems default to static linking.

2. **IP assignment audit** — For every contributor to the codebase:
   - **Employees**: Check that employment agreement contains IP assignment clause. Verify it carves out pre-existing IP and personal projects (required under CA Labor Code § 2870 — overbroad clauses make the entire agreement questionable).
   - **Contractors**: Check that a signed IP assignment exists SEPARATE from the invoice/SOW. "Work for hire" language alone is insufficient for software — it only applies to specific categories of work. A dedicated assignment clause is required.
   - **Founders**: Code written before company formation is owned by founders personally, not the company. Investors require a Founder IP Assignment at Series A. If a founder left before the assignment was executed, their contributions are a cloud on title.
   - **Open-source contributors**: If the project accepts external contributions, verify a CLA (Contributor License Agreement) is configured. Without a CLA, the company cannot relicense contributed code.

3. **Git history pre-incorporation check** — Scan `git log` for commits predating company formation date:
   - Commits before formation → code owned by the individual author, not the company
   - Check if Founder IP Assignment covers this pre-incorporation work
   - Flag if any pre-incorporation contributor is no longer associated with the company

4. **Copyright notice audit** — Check source files for proper copyright headers:
   - MIT/Apache 2.0 incorporated code must preserve the original copyright notice. Teams commonly strip headers during copy-paste — creating a technical license violation.
   - Company's own code should have copyright header (protects in litigation)
   - Flag files with no copyright header (ambiguous ownership)

5. **Trademark status check** — Assess brand protection:
   - LLC registration + domain ownership ≠ trademark rights. Federal registration establishes nationwide priority; common-law rights only protect the geographic area of active use.
   - Check if product name, company name, and key brand terms have USPTO registrations
   - Flag brand names operating without federal registration — a competitor in another state can file first and force a rebrand ($50K-$200K+ cost)
   - Check for existing registrations that could conflict (same or similar mark in related goods/services)

6. **Export control check** — For companies with international operations:
   - Encryption technology has export control implications (EAR Category 5, Part 2)
   - Open-source encryption is generally exempt, but custom encryption implementations may require BIS classification
   - Flag if product is distributed to sanctioned countries

7. **Generate IP audit report** — Write to `.rune/legal/ip/audit-<date>.md`:
   ```markdown
   # IP Audit: <Date>

   ## Status: [CLEAN / ISSUES FOUND / CRITICAL ISSUES]

   ## Dependency License Summary
   | License | Count | Risk Level | Action Required |
   |---------|-------|------------|-----------------|
   | MIT | X | Low | None |
   | Apache 2.0 | X | Low | None |
   | LGPL | X | Medium | Verify dynamic linking |
   | GPL | X | HIGH | Human review required |
   | AGPL | X | CRITICAL | Remove or open-source |
   | Unknown | X | HIGH | Identify license |

   ## High-Risk Dependencies
   | Package | License | Depth | Used By | Remediation |

   ## Contributor IP Status
   | Contributor | Type | IP Assignment | Status | Gap |
   |-------------|------|---------------|--------|-----|
   | [Name] | Founder | Founder IP Assignment | ✅/❌ | |
   | [Name] | Employee | Employment Agreement | ✅/❌ | |
   | [Name] | Contractor | IP Assignment | ✅/❌ | |

   ## Pre-Incorporation Code
   | Commit Range | Author | Covered by Assignment | Status |

   ## Trademark Status
   | Mark | USPTO Registration | Common Law | Risk |

   ## CLA Status
   | Repo | Accepts External PR | CLA Configured | Risk |

   ## Priority Remediation
   | # | Issue | Risk | Estimated Cost | Owner | Deadline |
   ```

**Sharp edges**:
- "Work for hire" ≠ IP assignment for software: US copyright law only recognizes "work for hire" for specific categories (contribution to collective work, part of a motion picture, etc.). Software is NOT automatically work-for-hire. A separate written assignment is required.
- MIT license "violation" from stripped headers: Technically a license breach. Unlikely to be enforced alone, but creates noise in M&A IP audit.
- LGPL dynamic vs. static linking: Many build tools (webpack, esbuild, Go compiler) produce static binaries by default. If an LGPL library is statically linked, copyleft triggers.
- Dual-licensed dependencies: Some packages offer GPL + commercial license. If using GPL version, copyleft applies. Check if a commercial license is already purchased.

---

### 6. `incident-legal`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Manage the legal dimension of security incidents — evidence preservation, notification deadlines, privilege protection, and regulatory filings — because the first 72 hours determine whether a breach costs $50K or $5M.

**When to use**: Immediately upon discovery of a security incident, data breach, or any event that may trigger regulatory notification obligations. Also for tabletop exercises and incident response plan review.

**Steps**:

1. **Assess legal exposure** — Based on incident type and data involved:
   - What data was affected? PII → state breach notification. PHI → HIPAA. EU data → GDPR.
   - How many individuals affected? HIPAA: >500 triggers media notification. GDPR: "high risk" triggers individual notification.
   - What was the attack vector? Ransomware, credential compromise, insider threat, misconfiguration, third-party breach.
   - Is litigation "reasonably anticipated"? If yes → litigation hold required IMMEDIATELY.

2. **Start notification deadline clock** — Calculate ALL applicable deadlines from discovery timestamp:

   | Regulation | Target | Deadline | Notes |
   |---|---|---|---|
   | GDPR Art. 33 | Supervisory authority | 72 hours from awareness | Preliminary filing allowed (supplement later) |
   | GDPR Art. 34 | Data subjects (high risk) | "Without undue delay" | Only if high risk to individuals |
   | HIPAA | HHS + affected individuals | 60 days from discovery | BA must notify covered entity "without unreasonable delay" |
   | HIPAA (>500) | Media in affected area | 60 days | Required for breaches affecting >500 individuals |
   | SEC (public co.) | Form 8-K | 4 business days from materiality determination | Pre-IPO: establish controls now for S-1 scrutiny |
   | California | AG + individuals | "Most expedient time possible" (~30 days) | $100-$750/consumer or actual damages |
   | NY SHIELD Act | AG | "Without unreasonable delay" | Civil penalties |
   | Cyber insurance | Carrier | Per policy (typically 24-72 hours) | Finance manages policy but isn't always in IR chain |

   **Write deadline calendar to `.rune/legal/incidents/<id>-deadlines.md` immediately.**

3. **Evidence preservation** — Issue BEFORE any remediation begins:
   - **Forensic images**: Disk images of affected systems before wiping/restoring
   - **Log preservation**: CloudTrail, CloudWatch, application logs, access logs, VPN logs — default retention is often 7-90 days. Extend retention NOW.
   - **Communication preservation**: Slack channels, email threads, ticket threads related to the incident
   - **Database snapshots**: Point-in-time snapshots of affected databases
   - **DO NOT**: Rotate logs, reimage systems, delete temp files, or restore from backups until forensic images are captured. The #1 technical mistake in incident response is IT restoring systems before preserving evidence.

4. **Litigation hold** — If litigation is reasonably anticipated:
   - Generate litigation hold notice template for all employees with relevant data
   - Scope: all documents, communications, data related to the incident, the affected systems, and the affected customers
   - **Must issue BEFORE routine retention policies delete relevant data** — Slack messages, emails, and logs deleted by auto-purge after a litigation trigger = spoliation of evidence = court sanctions, adverse inference, potential default judgment
   - Distribute hold notice to: IT, engineering, customer support, HR, executives

5. **Privilege protection** — Structure the investigation to preserve attorney-client privilege:
   - Engage IR forensics firm THROUGH outside counsel (not directly) — reports commissioned by counsel for litigation preparation are privileged; reports commissioned directly for compliance are NOT.
   - All investigation communications should include outside counsel and be marked "Attorney-Client Privileged / Work Product"
   - Internal post-mortem for operational improvement is separate from privileged investigation report
   - Courts test "predominant purpose" — if the IR report serves compliance AND litigation, it must be clearly structured as litigation preparation to maintain privilege

6. **Regulatory filing preparation** — Draft preliminary notifications:
   - GDPR: preliminary notification to supervisory authority (can supplement later) — key fields: nature of breach, categories of data, approximate number of affected individuals, likely consequences, measures taken
   - HIPAA: breach notification to HHS with required content (individual notifications follow)
   - State AG: per applicable state law requirements
   - **DO NOT** state "no evidence of exfiltration" unless logging was comprehensive enough to detect exfiltration. Absence of evidence is not evidence of absence — regulators scrutinize this claim post-breach.

7. **Generate incident legal report** — Write to `.rune/legal/incidents/<id>.md`:
   ```markdown
   # Incident Legal Report: <ID>

   ## Timeline
   | Timestamp | Event | Action | Owner |

   ## Legal Exposure Assessment
   | Regulation | Applicable | Deadline | Status | Filing |

   ## Data Impact
   | Data Type | Records Affected | Individuals | Jurisdictions |

   ## Evidence Preservation Status
   | System | Image/Snapshot | Timestamp | Preserved By |

   ## Litigation Hold
   | Issued | Scope | Recipients | Acknowledged |

   ## Privilege Log
   | Document | Author | Recipient | Privilege Basis |

   ## Notification Status
   | Target | Required | Deadline | Filed | Reference # |

   ## Insurance
   | Carrier | Policy # | Notified | Claim # |

   ## Stakeholder Communications
   | Audience | Draft | Reviewed By | Sent |

   ## Lessons Learned (NON-PRIVILEGED)
   - [system and process improvements — never individual blame]
   ```

**Sharp edges**:
- GDPR 72-hour clock starts at "awareness" — when IT detects anomalous activity, not when investigation concludes. File preliminary notification with incomplete information and supplement later.
- HIPAA BA notification chain: A healthcare SaaS (business associate) that discovers breach on day 55 and notifies the covered entity gives the hospital only 5 days to notify patients. Both parties violate HIPAA.
- SEC "determining materiality" timing: The 4-business-day clock starts when the company determines an incident is material, not at discovery. SEC is scrutinizing companies that delay materiality determinations.
- "No evidence of exfiltration" in breach notifications: If logging wasn't configured to detect exfiltration, this claim is not defensible. Regulators will ask what logging existed.
- Cyber insurance notification: Finance manages the policy but is often NOT in the incident response communication chain. Notify carrier within policy-specified window (typically 24-72 hours) or risk claim denial.

---

## Constraints

1. MUST read `.rune/business/context.md` before any compliance determination — regulatory exposure depends entirely on company profile (industry, geography, data types, customer segments)
2. MUST NOT provide legal advice or make legal decisions autonomously — all output is analysis and draft artifacts for human legal review. This pack assists legal decision-making, it does not replace legal counsel
3. MUST flag residuals clauses in every NDA review — residuals clauses allow legal trade secret extraction and are present in ~2% of NDAs, overwhelmingly from large tech companies
4. MUST check IP assignment status for every contributor type (founder, employee, contractor) — the default rule under US copyright law is that the creator owns the work, not the company that paid for it
5. MUST calculate ALL applicable notification deadlines from incident discovery timestamp — missing a 72-hour GDPR deadline or 60-day HIPAA deadline turns a manageable incident into a regulatory crisis
6. MUST preserve evidence BEFORE remediation — forensic images first, then restore. Destroying evidence before preservation is the #1 technical mistake in incident response
7. MUST structure IR investigations through outside counsel to preserve attorney-client privilege — reports commissioned directly (not through counsel) are NOT privileged
8. MUST check if stated policies match actual practices — a privacy policy that doesn't describe actual data collection is an FTC Section 5 deceptive practices violation

---

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Auto-renewal notice window missed, contract locked for another year | HIGH | `contract-review` adds every auto-renewal deadline to `.rune/legal/calendar.md` with advance notice alert |
| AGPL dependency discovered during M&A due diligence | CRITICAL | `ip-protection` scans full dependency tree including transitive dependencies; flags GPL/AGPL at any depth |
| Contractor built core product without IP assignment | CRITICAL | `ip-protection` cross-references contributor list against signed IP assignments; flags gaps immediately |
| Privacy policy describes practices the product doesn't follow | HIGH | `compliance-check` cross-references stated policy against codebase/config for tracking SDKs and data flows |
| Residuals clause in NDA allows counterparty to legally use trade secrets | HIGH | `nda-triage` searches for residuals clause keywords ("unaided memory," "retained in memory") in every review |
| Evidence destroyed before forensic preservation during incident | CRITICAL | `incident-legal` issues preservation checklist BEFORE any remediation step; blocks restore-from-backup until images captured |
| SOC 2 treated as HIPAA compliance (they're different) | HIGH | `compliance-check` explicitly flags when SOC 2 is present but BAAs are missing for PHI-handling services |
| Arbitration clause in handbook contradicts "not a contract" disclaimer | MEDIUM | `policy-generator` detects arbitration clauses in handbook body and recommends separate signed agreement |
| NDA expires while still actively disclosing → trade secret status destroyed | HIGH | `nda-triage` flags NDAs with duration shorter than expected relationship length |
| At-will + progressive discipline contradiction in handbook | MEDIUM | `policy-generator` flags when detailed PIP procedures coexist with at-will disclaimer |

---

## Cross-Pack Connections

| This Skill | Calls | For |
|---|---|---|
| `compliance-check` | `@rune-pro/finance.compliance-reporting` | Shared regulatory requirements (SOX financial controls, GDPR data mapping) |
| `incident-legal` | `incident` (L2 free) | Technical incident response coordination — legal handles notifications while incident handles containment |
| `incident-legal` | `@rune-pro/support.escalation-management` | Customer communication during incidents — legal reviews before support sends |
| `ip-protection` | `sentinel` (L2 free) | License scanning in dependencies — sentinel flags security vulns, ip-protection flags license risk |
| `contract-review` | `@rune-pro/finance.invoice-management` | Vendor contract terms feed into AP payment terms and early discount capture |
| `policy-generator` | `@rune-pro/support.knowledge-base` | Externally-facing policies (privacy, ToS) should be in customer-facing KB |
| `compliance-check` | `@rune-pro/product.feature-spec` | Compliance requirements feed into product specs (e.g., GDPR consent flow as a feature requirement) |
| All skills | `plan` (L2 free) | Structure multi-step legal projects |
| All skills | `docs` (L2 free) | Auto-update legal documentation |

---

## Done When

- `.rune/legal/reviews/` contains a review artifact for every contract signed in the current quarter, with risk assessment, redline suggestions, and auto-renewal deadlines logged in `.rune/legal/calendar.md`
- `.rune/legal/compliance/` contains a gap report for every applicable regulation, with evidence matrix, consent audit results, and subprocessor registry
- `docs/policies/` contains current versions of all required policies (privacy, ToS, AUP, data retention, incident response) with effective dates and review schedules
- `.rune/legal/nda/` contains triage reports for all active NDAs, with residuals clause status, signatory authority confirmation, and duration adequacy assessment
- `.rune/legal/ip/audit-<date>.md` exists with dependency license scan (including transitive), contributor IP assignment status for all contributors, and trademark status
- `.rune/legal/incidents/` contains legal reports for any incidents, with notification deadline tracking, evidence preservation status, and privilege log
- No policy in `docs/policies/` has a review date older than 12 months
- No active NDA has a duration shorter than the expected relationship length

---

## Cost Profile

| Skill | Model | Estimated Tokens | Notes |
|---|---|---|---|
| contract-review | sonnet | ~2,500 input / ~1,500 output | Clause analysis and risk assessment benefit from sonnet reasoning |
| compliance-check | sonnet | ~3,000 input / ~2,000 output | Regulatory mapping + data flow analysis across multiple frameworks |
| policy-generator | sonnet | ~2,000 input / ~1,800 output | Multi-section document generation with jurisdiction-aware content |
| nda-triage | haiku | ~1,000 input / ~600 output | Pattern matching for clause detection; structured rules, not deep reasoning |
| ip-protection | sonnet | ~2,500 input / ~1,500 output | Dependency tree analysis and contributor audit require multi-source reasoning |
| incident-legal | sonnet | ~2,000 input / ~1,500 output | Deadline calculation across multiple jurisdictions + privilege structuring |

**Typical quarterly run** (all six skills, startup with 20 active contracts): ~40,000 tokens total.
**Dominant cost driver**: compliance-check (regulatory mapping across multiple frameworks with data flow analysis).
**Optimization**: cache regulatory applicability determination as `.rune/legal/regulatory-profile.md` — only re-run when business context changes (new market, new data type, new jurisdiction).

## Jurisdiction Notes

| Jurisdiction | Key Differences | Common Startup Mistakes |
|---|---|---|
| **Delaware (US)** | Most startups incorporate here. Court of Chancery = specialized business court. | Not holding annual board meetings, not filing annual franchise tax ($400 min, can be $250K+ for high authorized shares) |
| **California (US)** | Non-competes unenforceable (Business & Professions Code §16600). Strongest employee protections. | Including non-compete in employment agreement → signals legal naïveté to acquirers |
| **EU (GDPR)** | 72-hour breach notification, DPO required in some cases, data subject rights (erasure, portability). | Privacy policy written for US law, no DPA with subprocessors, no cookie consent mechanism |
| **UK (post-Brexit)** | UK GDPR mirrors EU GDPR but requires separate UK representative if no UK establishment. | Assuming EU GDPR registration covers UK — it doesn't since Jan 2021 |
| **Singapore** | PDPA — similar to GDPR but with notable exceptions (business contact info exempt). | Over-engineering compliance to GDPR standard when PDPA suffices |
| **Vietnam** | Cybersecurity Law 2018 + Decree 13 — data localization requirements for certain data categories. | Storing Vietnamese user data on US servers without localization assessment |
