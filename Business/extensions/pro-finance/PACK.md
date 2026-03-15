---
name: "@rune-pro/finance"
description: Financial operations intelligence — budget planning, expense analysis, revenue forecasting, financial reporting, compliance reporting, invoice management, and cash flow optimization. Turns spreadsheet chaos into structured, auditable financial artifacts.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$149 lifetime (Business tier)"
  target: Founders, CFOs, finance leads, and operations managers who own financial operations at startups and SMBs
---

# @rune-pro/finance

## Purpose

Financial operations at startups fail in predictable, expensive ways: budgets built on static burn rates that ignore committed headcount, expense reports with 19% error rates that nobody catches until audit, MRR calculations that count annual contracts at full value in the signing month, P&L statements that mix cash and accrual basis without disclosure, compliance gaps that cost $200-500k in restatement fees when auditors arrive, invoices paid twice because vendor names have three spellings in the GL, and runway models that exclude payroll tax timing and security deposits from available cash. Each failure looks like a rounding error in the month it happens and a material misstatement by the time someone notices.

This pack gives a coding AI assistant the financial operations layer that catches these failures before they compound. Every skill writes to a predictable location under `.rune/finance/` or `reports/financial/` so every artifact is versioned, auditable, and survives team turnover. The pack reads from `.rune/business/context.md` for fiscal year, cost centers, and company stage — meaning once the context is seeded, every output is tailored to the company's actual financial structure without additional prompting.

The seven skills form a closed loop: `budget-planning` sets targets, `expense-analysis` tracks actuals against those targets, `revenue-forecasting` projects the top line, `financial-reporting` synthesizes everything into stakeholder-ready artifacts, `compliance-reporting` ensures the numbers meet regulatory standards, `invoice-management` controls the payables pipeline, and `cash-flow-optimization` translates all of it into the only number that kills companies — how much cash is actually available and when it runs out.

## Triggers

- Auto-trigger: when `.rune/business/context.md` exists with fiscal year or financial context
- Auto-trigger: when `.rune/finance/` directory exists (past financial artifacts detected)
- Auto-trigger: when `reports/financial/` directory exists
- `/rune finance` — manual invocation of the full pack
- `/rune finance budget` — single skill invocation
- Called by `cook` (L1) when financial planning, budgeting, or reporting context detected
- Called by `team` (L1) when a finance specialist subagent is needed
- Called by `@rune-pro/product.roadmap` when resource/budget constraints need validation

## Workflows

| Command | What It Does | Skills Used |
|---------|-------------|-------------|
| `/rune finance monthly-close` | Run expense analysis + P&L + cash position for month-end | expense-analysis → financial-reporting → cash-flow-optimization |
| `/rune finance board-prep` | Generate board deck package — KPIs, P&L, runway, asks | revenue-forecasting → financial-reporting → cash-flow-optimization |
| `/rune finance fundraise-ready` | Audit financials for investor due diligence readiness | compliance-reporting → financial-reporting → revenue-forecasting |
| `/rune finance reforecast` | Mid-year budget reforecast with updated actuals | expense-analysis → budget-planning → cash-flow-optimization |
| `/rune finance vendor-audit` | Duplicate detection + contract review + vendor concentration | invoice-management → expense-analysis |
| `/rune finance runway-check` | Quick forward-looking runway with committed spend | cash-flow-optimization (single skill, fast) |

### Fundraise Data Room Checklist

When `/rune finance fundraise-ready` is invoked, the pack validates and generates the financial artifacts investors expect in a data room:

```
## Financial Data Room — Minimum Viable Artifacts
- [ ] 3-year historical P&L (monthly granularity, GAAP basis)
- [ ] Current-year budget with base/bull/bear scenarios
- [ ] MRR waterfall with 12+ months of history
- [ ] Cohort retention analysis (logo + revenue churn by signup month)
- [ ] ARR bridge: beginning ARR → new + expansion - contraction - churn → ending ARR
- [ ] Unit economics: CAC, LTV, LTV/CAC ratio, payback period (months)
- [ ] Cash flow forecast (forward-looking, 18 months minimum)
- [ ] Cap table (fully diluted, including unexercised options and convertible instruments)
- [ ] 409A valuation (current — not expired, not >12 months old)
- [ ] Revenue recognition policy memo (ASC 606 compliance)
- [ ] Top 10 customers by ARR with contract end dates
- [ ] Accounts receivable aging (current, 30, 60, 90+ day buckets)
```

**Common data room failures** (any one can delay a round 4-8 weeks):
- P&L shows "adjusted EBITDA" without GAAP equivalent → investor asks for GAAP restatement
- MRR includes one-time setup fees or annual contracts at full value → investor recalculates, number drops 20-40%
- Cap table doesn't include SAFE notes or convertible debt → fully diluted share count is wrong
- 409A is 14 months old → must get new 409A before issuing option grants (delays hiring)

## SaaS Metrics Benchmarks

Quick-reference for interpreting financial outputs. Benchmarks from OpenView, Bessemer, and SaaStr for SaaS companies by ARR stage.

| Metric | Seed (<$1M ARR) | Series A ($1-5M) | Series B ($5-20M) | Growth ($20M+) |
|--------|-----------------|-------------------|---------------------|----------------|
| MoM MRR Growth | >15% | 8-15% | 5-8% | 3-5% |
| Gross Margin | >60% | >65% | >70% | >75% |
| Net Revenue Retention | >100% | >105% | >110% | >120% |
| Gross Churn (monthly) | <5% | <3% | <2% | <1.5% |
| Burn Multiple | <3x | <2x | <1.5x | <1x |
| CAC Payback (months) | <18 | <15 | <12 | <12 |
| Rule of 40 | N/A | 20+ | 30+ | 40+ |
| DSO (days) | <60 | <45 | <40 | <35 |
| Magic Number | >0.5 | >0.7 | >0.8 | >1.0 |

**How to read**: If your NRR is 95% at Series A, you have a churn problem that will compound. If your burn multiple is 4x at any stage, you're spending $4 to generate $1 of new ARR — unsustainable without unlimited capital.

## Business Context Setup

Before activating any skill, populate `.rune/business/` with the company's financial context. This directory is the single source of truth that all seven skills read from.

### Required Files

**`.rune/business/context.md`** — Company and financial context (shared with other pro packs):
```markdown
# Company Context

## Financial
- **Fiscal year**: Jan-Dec (or custom)
- **Accounting basis**: Accrual (or Cash — flag if switching)
- **Currency**: USD (primary), EUR (secondary if applicable)
- **Stage**: Seed / Series A / Series B / Growth / Profitable
- **Current ARR**: $X
- **Monthly burn**: $X (loaded, including benefits + taxes)
- **Cash balance**: $X (as of YYYY-MM-DD)
- **Runway**: X months (forward-looking, not static)

## Cost Centers
- Engineering: X headcount, $X/mo loaded
- Sales: X headcount, $X/mo loaded + commissions
- G&A: $X/mo (rent, insurance, legal, accounting)
- Marketing: $X/mo budget
```

**`.rune/business/processes.md`** — Financial processes and approval chains:
```markdown
# Financial Processes

## Expense Approval Thresholds
- < $500: Manager approval
- $500 - $5,000: VP approval
- $5,000 - $25,000: CFO approval
- > $25,000: CEO + CFO approval

## Budget Variance Thresholds
- < 5% variance: No action required
- 5-15% variance: Manager review + written explanation
- > 15% variance: CFO review + reforecast required

## Vendor Payment Terms
- Default: Net 30
- Strategic vendors: Net 45-60
- Early payment discount: 2/10 Net 30 (capture when available)

## Payroll Schedule
- Frequency: Bi-weekly (26 cycles/year — 2 months have 3 cycles)
- Pay day: Every other Friday
- Benefits deduction: Per-cycle

## Reporting Cadence
- Weekly: Cash position update
- Monthly: P&L, balance sheet, cash flow statement
- Quarterly: Board deck, compliance review, forecast update
- Annually: Budget planning, audit prep, 409A valuation
```

---

## Skills

### 1. `budget-planning`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Build multi-scenario budgets that account for committed spend, headcount timing, benefits burden, and contingency — not the straight-line spreadsheet that kills runway calculations.

**When to use**: Annual budget cycle, mid-year reforecast, board prep, fundraise modeling, or anytime "how much will we spend" needs a real answer.

**Steps**:

1. **Read financial context** — Load `.rune/business/context.md` for company stage, current burn, cost centers. Load `.rune/business/processes.md` for approval thresholds and variance limits. If context files are missing, prompt user to seed them before proceeding — budgets without company context are fiction.

2. **Gather cost categories** — Enumerate ALL cost categories, not just the obvious ones. Mandatory categories that startups miss:
   - **Payroll taxes**: 7.65% FICA (Social Security 6.2% + Medicare 1.45%) on top of every salary. A $150k engineer costs $161,475 before benefits.
   - **Benefits burden**: Health insurance, 401k match, dental/vision adds 20-30% on top of salary. A $150k engineer with benefits is $180-195k loaded.
   - **SaaS subscription creep**: Average SMB pays for 130+ SaaS tools, ~40% unused. Audit current subscriptions before budgeting forward.
   - **Payroll calendar anomaly**: Bi-weekly payroll = 26 cycles/year. Two months have 3 pay periods, not 2. Model this explicitly — a 50-person company hits a $150k surprise in those months.
   - **Sales commissions**: Often kick in mid-year as reps hit quota. Budget as variable cost tied to revenue forecast, not fixed.
   - **One-time costs disguised as recurring**: Office setup, rebrand, compliance audit, conference sponsorships.
   - **Contingency**: 10-15% buffer on total budget. Zero contingency = any unplanned cost forces a reforecast.

3. **Analyze historical actuals** — If prior period financials exist, compare budget vs. actual for each cost center. Calculate variance %. Flag categories where actuals exceeded budget by >15% — these need padding in the new budget. Flag categories where actuals were <50% of budget — these were over-budgeted or the project was cancelled.

4. **Project growth rates** — Model cost growth based on company stage:
   - **Headcount growth**: Use offer-letter pipeline, not wishes. Each hire has a start date — model the partial-month cost. A hire starting March 15 costs 50% of monthly loaded cost in March, 100% from April.
   - **Revenue-dependent costs**: Sales commissions, hosting costs (scale with users), payment processing fees (scale with GMV).
   - **Step-function costs**: Costs that jump at thresholds — new office lease at 50 employees, SOC2 audit at enterprise sales, additional AWS region at international expansion.

5. **Build three scenarios** — Never deliver a single budget. Build:
   - **Base case**: Most likely outcome. Uses median growth assumptions, planned headcount, known contracts.
   - **Bull case**: Revenue 20-30% above base, hiring plan accelerated, marketing spend increased. Shows what happens if things go well and you lean in.
   - **Bear case**: Revenue 20-30% below base, hiring freeze, discretionary spend cut to zero. Shows survival mode runway. This is the scenario the board actually cares about.

6. **Calculate runway per scenario** — Forward-looking runway, not static:
   ```
   DON'T: runway = cash_balance / avg_burn_last_3_months
   DO:    runway = months until cumulative_forward_burn > cash_balance
   ```
   Forward burn must include: committed headcount (offer letters out), signed vendor contracts, rent escalations, payroll tax timing (quarterly estimated taxes), and exclude non-liquid assets (security deposits, prepaid expenses).
   - Flag when stated runway diverges >20% from forward-looking calculation.

7. **Set variance thresholds** — Per `.rune/business/processes.md` variance policy. For each cost center, define:
   - Green: within 5% of budget
   - Yellow: 5-15% over budget — manager must explain
   - Red: >15% over budget — CFO review + reforecast trigger

8. **Generate budget artifact** — Write to `.rune/finance/budget-<period>.md` using template:
   ```markdown
   # Budget: <Period> (<Scenario>)

   ## Summary
   | Metric | Base | Bull | Bear |
   |--------|------|------|------|
   | Total Revenue | $X | $Y | $Z |
   | Total Expenses | $X | $Y | $Z |
   | Net Burn | $X | $Y | $Z |
   | Runway (months) | X | Y | Z |
   | Contingency (%) | X% | - | - |

   ## Revenue Breakdown
   | Stream | Monthly | Annual | Growth Assumption |

   ## Expense Breakdown by Cost Center
   | Category | Q1 | Q2 | Q3 | Q4 | Annual | vs Prior Year |

   ## Headcount Plan
   | Role | Start Date | Monthly Loaded Cost | Annual Impact |

   ## Key Assumptions
   - [list every growth rate, timing, and threshold assumption]

   ## Variance Monitoring
   | Category | Budget | Threshold (Yellow) | Threshold (Red) |

   ## Risks & Contingencies
   - [specific risks with dollar impact estimates]
   ```

**Sharp edges**:
- Bookings ≠ cash ≠ ARR: A $120k annual contract signed in December delivers ~$10k revenue in the fiscal year (accrual) or $0 cash (if Net 30 terms). Budget must specify which basis.
- Headcount timing: Budget shows 10 Q1 hires but onboarding takes 45-60 days — loaded cost hits Q2, not Q1. Model start dates, not headcount targets.
- Benefits open enrollment: Annual benefits cost can jump 8-15% at renewal. Budget last year's rate = understated by renewal month.

---

### 2. `expense-analysis`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash

**Purpose**: Analyze expense data against budget, detect anomalies, enforce policy compliance, and produce actionable reports — before the auditor finds the problems.

**When to use**: Monthly close, quarterly review, pre-audit prep, or when expense trends look wrong.

**Steps**:

1. **Load expense data** — Read expense reports, credit card statements, or GL export. Normalize vendor names (Acme Corp, ACME Corporation, Acme Corp. → single canonical name). Flag vendor name variants for consolidation — duplicate vendors are the #1 cause of missed spend analytics.

2. **Categorize and validate** — Map each expense to standard taxonomy (COGS, R&D, S&M, G&A). Flag miscategorizations:
   - Team dinner filed as "software" → should be "meals & entertainment"
   - AWS bill filed as "G&A" → should be "COGS" or "R&D" depending on use
   - Conference ticket filed as "travel" → should be "marketing" or "professional development"
   - Contractor payment filed as "consulting" when it's really "R&D labor"

3. **Detect anomalies** — Flag for human review:
   - **Duplicate claims**: Same vendor + amount within ±5% + within 30 days
   - **Policy violations**: Hotel >$200/night, flights >$500 without pre-approval, meals >$75/person
   - **Stale receipts**: Submitted >30 days after transaction date (19% of expense reports contain errors — late submissions are the top cause)
   - **Personal charges**: Vendor category mismatch on corporate card (e.g., Spotify, Netflix, personal Amazon)
   - **Outlier amounts**: Any single expense >2 standard deviations from category average

4. **Trend analysis** — Compare current period to prior 3 months and prior year same period:
   - Category-level growth rates (is cloud spend growing faster than revenue?)
   - Per-employee expense trends (travel cost per sales rep, SaaS cost per engineer)
   - Vendor concentration risk (>20% of total spend with single vendor)

5. **Budget variance** — Compare actuals to budget per cost center. Apply variance thresholds from `.rune/business/processes.md`. For each Red category, require written variance explanation.

6. **Policy compliance scoring** — Score each department 0-100 on expense policy compliance:
   - Receipt attachment rate
   - On-time submission rate
   - Within-policy rate
   - Proper categorization rate

7. **Generate report** — Write to `.rune/finance/expense-report-<period>.md`:
   ```markdown
   # Expense Analysis: <Period>

   ## Executive Summary
   - Total expenses: $X (vs budget: $Y, variance: Z%)
   - Anomalies flagged: N (duplicates: X, policy violations: Y, outliers: Z)
   - Top spending categories: [ranked list]

   ## Anomalies Requiring Review
   | Date | Vendor | Amount | Category | Flag Type | Action Required |

   ## Budget Variance by Cost Center
   | Cost Center | Budget | Actual | Variance | Status |

   ## Trend Analysis
   | Category | This Month | 3-Mo Avg | YoY | Trend |

   ## Policy Compliance Scorecard
   | Department | Receipt % | On-Time % | In-Policy % | Score |

   ## Recommendations
   - [specific actions with dollar impact]
   ```

**Sharp edges**:
- Per diem vs. actual reimbursement: Switching policies mid-year breaks historical comparison. Note the switchover date in the report.
- Multi-currency expenses: Employee converts hotel cost at wrong exchange rate — inflates or deflates by 3-8%. Use transaction-date rate, not submission-date rate.
- Contractor vs. employee reimbursement: Tax treatment differs. Reimbursing contractors the same way as employees creates 1099 reporting errors.

---

### 3. `revenue-forecasting`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Build revenue forecasts that decompose MRR correctly, handle seasonality, and separate bookings from recognized revenue — because the wrong MRR number kills fundraising.

**When to use**: Monthly forecast update, board prep, fundraise modeling, or when revenue numbers "feel off."

**Steps**:

1. **Identify revenue streams** — Enumerate all sources: subscription MRR, usage-based revenue, one-time setup fees, professional services, marketplace take-rate. Each stream has different recognition rules and growth dynamics.

2. **Decompose MRR waterfall** — Break MRR into mandatory components:
   ```
   Beginning MRR
   + New MRR (first-time customers)
   + Expansion MRR (upgrades, seat additions)
   + Reactivation MRR (churned customers returning)
   - Contraction MRR (downgrades)
   - Churned MRR (cancellations)
   = Ending MRR
   ```
   **Critical**: Annual contracts must be normalized to monthly. A $5,400/yr contract = $450/mo MRR, NOT $5,400 in the signing month. Flag any MRR calculation that counts annual contract value in a single month — this inflates MRR by 12x for that contract.

3. **Validate churn calculation** — Check churn denominator:
   ```
   CORRECT: Churn Rate = Churned MRR / Beginning-of-Period MRR
   WRONG:   Churn Rate = Churned MRR / End-of-Period MRR (inflated by new business)
   ```
   Separate logo churn (customer count) from revenue churn (dollar amount). If 5 of 100 customers churn but they were the 3 largest accounts, logo churn is 5% but revenue churn could be 25%. Always report both.

4. **Apply seasonality** — B2B SaaS close rates drop 30-40% in December (holidays) and August (EU vacations). Consumer products spike in Q4. Apply historical seasonality coefficients by month, not straight-line growth. If <12 months of history, use industry benchmarks and flag low confidence.

5. **Model expansion and contraction** — Calculate Net Revenue Retention (NRR):
   ```
   NRR = (Beginning MRR + Expansion - Contraction - Churn) / Beginning MRR
   ```
   NRR > 100% = net negative churn (excellent). NRR < 90% = leaky bucket (urgent). Track NRR by cohort (signup month) to detect whether newer customers retain better or worse than older ones.

6. **Build three scenarios** — Match budget scenarios:
   - **Base**: Current pipeline × historical close rate × seasonality
   - **Bull**: Pipeline × (close rate + 10%) + unforecasted inbound at historical rate
   - **Bear**: Pipeline × (close rate - 15%) + extended sales cycles (add 30 days)

7. **Cross-check with cash** — Forecast recognized revenue, then model cash collection:
   - Apply DSO (Days Sales Outstanding) to determine when cash arrives
   - Flag when DSO is trending up (>5 day increase over 3 months = AR collection problem)
   - Show deferred revenue balance — prepaid annual contracts are cash but not revenue

8. **Generate forecast artifact** — Write to `.rune/finance/forecast-<period>.md`:
   ```markdown
   # Revenue Forecast: <Period>

   ## MRR Waterfall
   | Component | Current | +1 Mo | +2 Mo | +3 Mo | +6 Mo | +12 Mo |

   ## Key Metrics
   | Metric | Current | 3-Mo Trend | Benchmark |
   |--------|---------|------------|-----------|
   | MRR | $X | ↑/↓ X% | - |
   | ARR | $X | ↑/↓ X% | - |
   | Net Revenue Retention | X% | ↑/↓ | >110% good |
   | Gross Churn | X% | ↑/↓ | <5% good |
   | Logo Churn | X% | ↑/↓ | <3% good |
   | DSO | X days | ↑/↓ | <45 good |
   | Burn Multiple | Xx | ↑/↓ | <2x good |

   ## Scenario Comparison
   | Scenario | +3 Mo ARR | +12 Mo ARR | Key Assumptions |

   ## Cohort Analysis
   | Cohort | Starting MRR | Current MRR | Retention | NRR |

   ## Risks
   - [specific revenue risks with dollar impact]

   ## Cash Collection Forecast
   | Month | Recognized Revenue | Expected Cash | DSO Assumption |
   ```

**Sharp edges**:
- Trial-to-paid timing: Counting trials in MRR before conversion inflates MRR by ~70% if conversion rate is 30%. Only count converted subscriptions.
- Reactivated vs. new: A churned customer returning is reactivation MRR, not new MRR. Conflating them inflates new business metrics.
- Multi-year contracts with price escalators: Year 2 rate is higher. ARR at signing reflects Year 1 only — don't average across contract life.
- Bookings vs. ARR: A $120k 3-year contract: bookings = $120k, ARR = $40k, MRR = $3,333. Reporting ARR as $120k to investors is a material misrepresentation.

---

### 4. `financial-reporting`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash

**Purpose**: Produce stakeholder-ready financial reports — P&L, balance sheet, cash flow, board deck — that follow GAAP/IFRS principles and don't contain the anti-patterns that kill fundraising due diligence.

**When to use**: Monthly close, quarterly board meeting, investor update, fundraise data room, acquisition due diligence.

**Steps**:

1. **Determine report type and audience** — Each audience needs different depth:
   - **CEO/Founder**: Summary P&L, cash position, runway, KPIs
   - **CFO/Controller**: Detailed P&L with account-level breakdown, balance sheet, cash flow
   - **Board**: Board deck format — KPIs, P&L summary, cash runway, key decisions needed
   - **Investors**: GAAP-compliant financials, ARR/MRR metrics, cohort data, cap table

2. **Validate accounting basis consistency** — Check if the report mixes cash and accrual:
   - Revenue recognized = cash received? → Likely cash basis (flag if company claims accrual)
   - Deferred revenue on balance sheet? → If missing but annual contracts exist, accrual is wrong
   - Prepaid expenses amortized monthly? → If $60k annual license expensed fully in January, P&L is distorted

3. **Build P&L with mandatory checks**:
   - **Gross margin**: Exclude sales commissions, customer success payroll, and implementation costs from COGS. These are S&M or G&A. Gross margin that includes them is understated and misleads investors.
   - **Prior period comparison**: ALWAYS include prior month and prior year same month. A P&L without comparatives is useless — "$500k revenue" means nothing without "vs. $400k last month, vs. $200k same month last year."
   - **EBITDA add-backs**: If showing adjusted EBITDA, list EVERY add-back explicitly. Stock-based compensation, restructuring, and "one-time" items that recur every quarter are red flags. Show GAAP EBITDA alongside adjusted.
   - **CapEx vs. OpEx**: Internal software development may qualify for capitalization (ASC 350-40). If capitalized, amortize over 3-5 years. If expensed, show consistently. Don't switch treatment between periods without disclosure.

4. **Build balance sheet checks**:
   - Deferred revenue liability must exist if annual/multi-year contracts are sold
   - Accounts receivable aging: flag if >20% of AR is 60+ days
   - Cap table must reconcile with legal docs (option pool, convertible notes, SAFEs)
   - Founder loans/advances must be classified correctly (loan payable vs. equity contribution)

5. **Build cash flow statement** — Reconcile net income to cash:
   - Operating: net income + non-cash items (depreciation, SBC) + working capital changes
   - Investing: CapEx, security deposits, acquisitions
   - Financing: fundraising proceeds, debt, founder loans
   - Ending cash must tie to bank statement. If it doesn't, find the delta before publishing.

6. **Format for audience** — Apply the correct template:
   - Board deck: max 15 slides, lead with KPIs and decisions needed, not raw numbers
   - Investor update: narrative + data, focus on growth metrics and efficiency
   - Internal: full detail, account-level, with variance explanations

7. **Generate report** — Write to `reports/financial/<type>-<period>.md`:
   ```markdown
   # <Report Type>: <Period>

   ## Key Metrics Dashboard
   | Metric | Current | Prior Month | Prior Year | Trend |

   ## Profit & Loss
   | Line Item | Current | Prior Month | Budget | Variance |
   |-----------|---------|-------------|--------|----------|
   | Revenue | | | | |
   | COGS | | | | |
   | Gross Profit | | | | |
   | Gross Margin % | | | | |
   | Operating Expenses | | | | |
   | - R&D | | | | |
   | - S&M | | | | |
   | - G&A | | | | |
   | EBITDA | | | | |
   | Net Income | | | | |

   ## Balance Sheet Summary
   | Item | Current | Prior Month |

   ## Cash Flow
   | Category | Amount |

   ## Commentary
   - [variance explanations, key events, forward-looking notes]
   ```

**Sharp edges**:
- "Adjusted EBITDA" abuse: Adding back SBC, restructuring, and "one-time" items every quarter eventually means everything is "one-time." Auditors and acquirers see through this.
- Non-GAAP metrics without GAAP disclosure: Showing "non-GAAP gross margin" in a board deck without the GAAP equivalent is a due diligence red flag.
- Prepaid expense timing: Paying $60k annual software license in January, expensing fully in January instead of amortizing $5k/month distorts Q1 profitability by $55k.
- Inter-company transactions: Founder pays $5k server with personal card and logs as "revenue" — should be either loan payable or capital contribution.

---

### 5. `compliance-reporting`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Prepare audit-ready compliance artifacts, detect control gaps, and prevent the $200-500k restatement that happens when auditors arrive and find 3 years of incorrect revenue recognition.

**When to use**: Pre-audit prep, SOC2 readiness, SOX readiness (pre-IPO), annual compliance review, or after a material event (fundraise, acquisition offer, regulatory inquiry).

**Steps**:

1. **Identify applicable regulations** — Based on company stage, industry, and geography:
   - **All startups**: Tax compliance (federal + state), payroll tax, 1099 contractor reporting
   - **SaaS with annual contracts**: ASC 606 revenue recognition
   - **Pre-Series B+**: SOX-equivalent internal controls (investors expect this even pre-IPO)
   - **Customer data**: SOC2 Type II, GDPR (EU customers), CCPA (CA customers), HIPAA (health data)
   - **Equity**: 409A valuation (must be updated every 12 months or after material events)

2. **Map requirements to evidence** — For each regulation, identify what documentation is needed:
   - **Revenue recognition (ASC 606)**: Signed contracts, delivery evidence, milestone documentation
   - **SOX controls**: Segregation of duties matrix, access control logs, transaction approval records
   - **409A**: Current valuation report, board resolution approving valuation, option grant records
   - **Tax**: Quarterly estimated payments, state nexus analysis, sales tax collection records

3. **Audit evidence completeness check** — Cross-reference required evidence against available documentation. Common gaps (startups typically have ~40% of required docs missing):
   - Board minutes not signed or not created for material transactions
   - Signed contracts missing for revenue-recognized deals (verbal agreements)
   - Cap table not reconciled with legal docs after each round
   - Payroll records incomplete for terminated employees
   - IP assignment agreements missing for early employees/contractors

4. **Segregation of duties audit** — Check if the same person performs incompatible functions:
   - Same person enters AND approves invoices → material control weakness
   - Same person manages AND reconciles bank accounts → fraud risk
   - Same person grants AND administers system access → security risk
   - For teams <10 people, document compensating controls (dual sign-off, board oversight)

5. **409A valuation tracking** — Check:
   - Date of last 409A: if >12 months ago, flag as expired
   - Material events since last 409A: new funding round, acquisition offer, revenue milestone → requires new 409A
   - Options granted after 409A expiry: potential IRS Section 409A penalty exposure for employees (20% tax + interest)

6. **Generate compliance gap report** — Write to `.rune/finance/compliance/<regulation>-<period>.md`:
   ```markdown
   # Compliance Report: <Regulation> — <Period>

   ## Status: [COMPLIANT / GAPS DETECTED / CRITICAL GAPS]

   ## Requirements Matrix
   | Requirement | Evidence Required | Status | Gap | Risk Level | Remediation |

   ## Segregation of Duties
   | Function | Person | Conflict | Compensating Control |

   ## 409A Status
   | Last Valuation | Expiry | Material Events Since | Action Required |

   ## Audit Readiness Score: X/100
   - Documentation completeness: X%
   - Control effectiveness: X%
   - Remediation items: N

   ## Priority Remediation Plan
   | # | Gap | Risk | Owner | Deadline | Estimated Cost |
   ```

**Sharp edges**:
- "We're not public, SOX doesn't apply" — Wrong. Investors and acquirers expect SOX-equivalent controls from Series B onward. Discovering gaps during due diligence kills deals.
- Related party transactions: Founder-owned entity selling services to the startup at non-market rates must be disclosed and priced at fair market value.
- Contractor misclassification: Paying someone as a 1099 contractor for 18 months while they work full-time on-site creates retroactive payroll tax liability (employer portion + penalties + interest). IRS has a 20-factor test.
- Audit log retention: AWS CloudTrail logs deleted after 90 days by default. If auditors request 2 years of access logs, the data doesn't exist. Configure retention before audit, not during.

---

### 6. `invoice-management`

**Model**: haiku
**Tools**: Read, Write, Edit, Bash

**Purpose**: Control the accounts payable pipeline — detect duplicate invoices, enforce three-way match, capture early payment discounts, and prevent the 0.1-0.5% duplicate payment rate that costs $2-10k per $2M in vendor spend.

**When to use**: Invoice processing, monthly AP review, vendor reconciliation, or when duplicate payment is suspected.

**Steps**:

1. **Ingest and normalize** — Read invoice data (email attachment, PDF, CSV export from AP system). Extract key fields: vendor name, invoice number, date, amount, due date, payment terms, line items. Normalize vendor names to canonical form — "Acme Corp", "ACME Corporation", "Acme Corp." must resolve to one vendor ID.

2. **Duplicate detection** — Flag potential duplicates using multi-signal matching:
   - Same vendor + same invoice number (exact duplicate)
   - Same vendor + amount within ±5% + date within 30 days (near-duplicate)
   - Same amount + same date + different vendor name variant (vendor name mismatch)
   - Check against payment history: was a payment already issued for this invoice?

3. **Three-way match** — If PO system exists, validate:
   - Invoice amount ≤ PO amount (flag overages)
   - Invoice line items match PO line items (quantity, unit price)
   - Goods/services received confirmation exists
   - If no PO system: flag all invoices >$1,000 that lack pre-approval documentation

4. **Payment term optimization** — For each invoice:
   - Calculate early payment discount value: 2/10 Net 30 = 2% discount for paying 20 days early = 36.7% annualized return
   - Flag invoices approaching early payment discount deadline
   - Prioritize payments: (1) capture discounts, (2) strategic vendor relationships, (3) standard terms

5. **Aging analysis** — Categorize AP by age bucket:
   - Current (0-30 days)
   - 31-60 days
   - 61-90 days
   - 90+ days
   - Flag when 60+ day bucket is growing as % of total AP — this indicates processing bottleneck or cash flow problem

6. **Generate AP report** — Write to `.rune/finance/invoices/summary-<period>.md`:
   ```markdown
   # AP Summary: <Period>

   ## Overview
   - Total invoices processed: N
   - Total value: $X
   - Duplicates caught: N ($X saved)
   - Early payment discounts captured: $X
   - Early payment discounts missed: $X

   ## Duplicates Flagged
   | Invoice # | Vendor | Amount | Match Type | Action |

   ## Aging Analysis
   | Bucket | Count | Value | % of Total | Trend |

   ## Payment Priority Queue
   | Invoice | Vendor | Amount | Due | Discount Available | Priority |

   ## Vendor Concentration
   | Vendor | YTD Spend | % of Total | Contract End Date |

   ## Credit Memos Outstanding
   | Vendor | Credit Amount | Date Issued | Applied? |
   ```

**Sharp edges**:
- Credit memos not applied: Vendor issues $2k credit memo, AP logs it but never applies to next invoice. Company overpays. Credit sits in GL forever — audit this quarterly.
- Foreign vendor withholding: Paying foreign contractors without withholding for US-source income violates IRS 1042-S rules. Check vendor tax status before first payment.
- Decimal transposition: $12,345.00 vs. $12,354.00 often passes manual review. Check invoice amounts against contract amounts to catch.
- Auto-pay + manual pay collision: Vendor on auto-pay also gets a manual payment when someone forwards the invoice to AP. Double payment ensues.

---

### 7. `cash-flow-optimization`

**Model**: sonnet
**Tools**: Read, Write, Edit, Bash, Agent

**Purpose**: Model real cash position and runway using forward-looking committed spend — because static burn rate runway calculations are the single most dangerous financial error at startups.

**When to use**: Weekly cash position update, runway planning, fundraise timing, board cash report, or anytime "how long do we have" needs a truthful answer.

**Steps**:

1. **Map cash inflows** — All sources of cash entering the company:
   - Customer payments (apply DSO — cash arrives later than revenue is recognized)
   - Committed pipeline (apply close rate × average collection time)
   - Deferred revenue (already collected, sitting in bank — but it's a liability, not free cash)
   - Financing (debt draws, funding rounds in progress — only count closed rounds)
   - Other (tax refunds, security deposit returns, litigation settlements)

2. **Map cash outflows** — ALL sources, including the ones founders forget:
   - **Payroll**: Use actual payroll calendar (26 bi-weekly cycles, NOT 24). Model the 2 months/year with 3 pay periods explicitly.
   - **Committed headcount**: Offer letters outstanding = cash commitment starting on start date. A $200k/yr hire with March 15 start date = $8.3k outflow in March (half month loaded).
   - **Signed vendor contracts**: AWS reserved instances, annual SaaS contracts, office lease. These are committed whether or not revenue comes in.
   - **Payroll taxes**: Quarterly estimated federal + state taxes. A profitable startup's Q4 tax payment can be $50-200k — missing this in cash model is catastrophic.
   - **One-time committed**: Equipment orders, conference sponsorships, security deposits.
   - **Exclude non-liquid "cash"**: Security deposits, prepaid expenses, restricted cash — these appear on balance sheet but cannot pay bills.

3. **Identify timing mismatches** — Cash flow is about timing, not amounts:
   - Customer invoiced Net 30 but pays Day 52 (actual DSO > terms) — AR is growing
   - Marketing spend incurred 90-120 days before revenue it generates
   - Sales rep cost (salary + commission) incurred 30-60 days before deal closes
   - Annual insurance premium due in January ($60k), but budget models $5k/month

4. **Model scenarios with committed spend**:
   ```
   Forward-Looking Monthly Burn:
     Current payroll (loaded)           $X
   + Committed new hires (by start date) $Y
   + Signed vendor contracts             $Z
   + Variable costs (% of revenue)       $W
   + Payroll tax true-up (quarterly)     $V
   = Total Forward Monthly Burn          $TOTAL

   Runway = months until Σ(forward_burn) > available_cash
   Available cash = bank balance - restricted cash - security deposits
   ```

5. **Working capital analysis** — The faster you grow, the more cash you need upfront:
   - Calculate cash conversion cycle: DSO + DIO - DPO
   - If growing 100% YoY, working capital gap doubles — model the cash needed to fund growth
   - Calculate burn multiple: net burn / net new ARR. >2x = burning too fast relative to growth

6. **Vendor term negotiation opportunities** — Identify where extending payment terms frees cash:
   - Which vendors offer Net 60 or Net 90? Switch from Net 30 where possible.
   - Which vendors offer early payment discounts? 2/10 Net 30 = 36.7% annualized — worth capturing if cash is available.
   - Which annual contracts could switch to monthly at modest premium? Preserves optionality.

7. **Generate cash flow report** — Write to `.rune/finance/cash-flow-<period>.md`:
   ```markdown
   # Cash Flow Analysis: <Period>

   ## Cash Position
   | Metric | Current | +1 Mo | +3 Mo | +6 Mo | +12 Mo |
   |--------|---------|-------|-------|-------|--------|
   | Bank Balance | $X | | | | |
   | - Restricted | ($X) | | | | |
   | = Available Cash | $X | | | | |
   | Monthly Burn (forward) | $X | | | | |
   | Runway (months) | X | | | | |

   ## Burn Composition
   | Category | Current | Committed (next 3 mo) | % of Total |

   ## Cash Inflow Forecast
   | Source | +1 Mo | +3 Mo | +6 Mo | Confidence |

   ## Timing Risks
   | Risk | Impact | Probability | Mitigation |

   ## Efficiency Metrics
   | Metric | Current | Target | Status |
   |--------|---------|--------|--------|
   | DSO | X days | <45 | |
   | Burn Multiple | Xx | <2x | |
   | Cash Conversion Cycle | X days | <60 | |
   | NRR | X% | >110% | |

   ## Recommendations
   - [specific actions with cash impact and timeline]
   ```

**Sharp edges**:
- "$2M ARR" ≠ "$2M/year coming in": If annual contracts were front-loaded in Q1, cash flow is lumpy not smooth. Model actual collection timing, not ARR/12.
- Tax payment cliff: Federal quarterly estimated taxes, state taxes, payroll taxes — often missing from cash models. A profitable startup can run out of cash paying its tax bill.
- Deferred revenue is cash but not free cash: Startup collects $1.2M in Q1 prepayments, spends it in Q2-Q3. By Q4, the revenue recognizes but cash is gone. The deferred revenue liability was real money that funded operations — now there's a liquidity gap.
- Security deposits are not liquid: $100k office deposit + $60k prepaid insurance are balance sheet assets but cannot pay payroll. Exclude from runway calculation.

---

## Constraints

1. MUST read `.rune/business/context.md` and `.rune/business/processes.md` before any financial calculation — never hardcode fiscal years, tax rates, or approval thresholds; they vary by company
2. MUST NOT make financial decisions autonomously — all output is draft-only until a human with financial authority reviews and approves. This pack produces artifacts, not actions
3. MUST use forward-looking burn rate for runway calculations — static "cash / last 3 months burn" is the single most dangerous financial shortcut and MUST be flagged when detected
4. MUST normalize annual contracts to monthly when calculating MRR — booking full annual value in signing month inflates MRR by 12x and is a material misrepresentation
5. MUST include payroll tax burden (7.65% FICA) and benefits load (20-30%) when modeling headcount cost — salary-only budgeting understates true cost by 30-40%
6. MUST separate logo churn from revenue churn in all reporting — 5% logo churn with 25% revenue churn are completely different situations
7. MUST show GAAP metrics alongside any non-GAAP or "adjusted" metrics — presenting adjusted EBITDA without GAAP equivalent is a due diligence red flag
8. MUST flag when same person performs incompatible financial functions (enter + approve, manage + reconcile) — this is a material internal control weakness

---

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Runway calculated with static burn while offer letters are outstanding | CRITICAL | `cash-flow-optimization` must include committed headcount from offer letters in forward burn — query user for outstanding offers |
| MRR includes full annual contract value in signing month | CRITICAL | `revenue-forecasting` normalizes all contracts to monthly before any MRR calculation |
| P&L mixes cash and accrual basis without disclosure | HIGH | `financial-reporting` checks if recognized revenue = cash received and flags basis inconsistency |
| Budget uses salary-only headcount cost (no benefits, no payroll tax) | HIGH | `budget-planning` auto-adds FICA + benefits multiplier (1.3-1.4x salary) to every headcount line |
| Bi-weekly payroll modeled as 2x/month instead of 26 cycles/year | HIGH | `budget-planning` identifies the 2 months with 3 pay periods and models explicitly |
| 409A valuation expired or post-material-event without update | HIGH | `compliance-reporting` checks 409A date and flags if >12 months old or material event occurred |
| Duplicate invoice paid due to vendor name variant | MEDIUM | `invoice-management` normalizes vendor names and flags same-amount-same-period across name variants |
| Deferred revenue spent before earned, creating Q4 liquidity gap | HIGH | `cash-flow-optimization` models deferred revenue burn-down against recognition schedule |
| Early payment discount missed because approval took too long | MEDIUM | `invoice-management` flags discounts approaching deadline and calculates annualized value |
| Expense categorized incorrectly, distorting cost center P&L | MEDIUM | `expense-analysis` cross-checks vendor type against submitted category |

---

## Cross-Pack Connections

| This Skill | Calls | For |
|---|---|---|
| `revenue-forecasting` | `@rune-pro/sales.pipeline-review` | Pipeline data for revenue scenarios |
| `cash-flow-optimization` | `@rune-pro/product.roadmap` | Resource requirements and timeline for cash planning |
| `compliance-reporting` | `@rune-pro/legal.compliance-check` | Shared regulatory requirements (SOX↔GDPR overlap) |
| `financial-reporting` | `@rune-pro/product.release-comms` | Align financial milestones with product releases for board narrative |
| `budget-planning` | `@rune-pro/sales.daily-briefing` | Sales capacity and commission model inputs |
| `expense-analysis` | `sentinel` (L2 free) | Flag vendor security risks alongside financial vendor review |
| `budget-planning` | `@rune-pro/legal.contract-review` | Vendor contract terms and renewal dates for accurate budget modeling |
| `compliance-reporting` | `@rune-pro/legal.ip-protection` | IP assignment status feeds into audit readiness scoring |
| All skills | `plan` (L2 free) | Structure multi-step financial projects |
| All skills | `docs` (L2 free) | Auto-update financial documentation |

---

## Done When

- `.rune/finance/budget-<period>.md` exists with three scenarios (base/bull/bear), loaded headcount costs, contingency allocation, and forward-looking runway for current fiscal period
- `.rune/finance/expense-report-<period>.md` exists with anomaly flags, budget variance by cost center, and policy compliance scorecard for current month
- `.rune/finance/forecast-<period>.md` exists with MRR waterfall decomposition, NRR by cohort, and three revenue scenarios for current quarter
- `reports/financial/` contains P&L with prior period comparatives, GAAP EBITDA alongside any adjusted metrics, and deferred revenue reconciliation
- `.rune/finance/compliance/` contains gap report with segregation of duties matrix, 409A status, and evidence completeness score
- `.rune/finance/invoices/summary-<period>.md` exists with duplicate detection results, aging analysis, and early payment discount capture report
- `.rune/finance/cash-flow-<period>.md` exists with forward-looking burn (including committed headcount and signed contracts), available cash (excluding restricted), and runway in months

---

## Cost Profile

| Skill | Model | Estimated Tokens | Notes |
|---|---|---|---|
| budget-planning | sonnet | ~2,500 input / ~1,800 output | Multi-scenario modeling requires coherent reasoning across interdependent variables |
| expense-analysis | sonnet | ~2,000 input / ~1,200 output | Anomaly detection and categorization validation benefit from sonnet pattern recognition |
| revenue-forecasting | sonnet | ~2,500 input / ~1,500 output | MRR decomposition and churn math require careful arithmetic |
| financial-reporting | sonnet | ~3,000 input / ~2,000 output | Multi-format output (P&L, balance sheet, board deck) with GAAP compliance checks |
| compliance-reporting | sonnet | ~2,000 input / ~1,500 output | Regulatory mapping requires broad knowledge of compliance frameworks |
| invoice-management | haiku | ~1,500 input / ~800 output | Pattern matching for duplicates; structured rules, not deep reasoning |
| cash-flow-optimization | sonnet | ~2,500 input / ~1,500 output | Forward-looking modeling with committed spend requires multi-variable reasoning |

**Typical monthly run** (all seven skills, startup with 50 employees): ~45,000 tokens total.
**Dominant cost driver**: financial-reporting (multi-format output with compliance checks).
**Optimization**: cache business context summary as `.rune/finance/context-snapshot.md` after each run to avoid re-reading full business context files.

## Currency & Localization Notes

| Context | Rule | Why |
|---|---|---|
| Multi-currency P&L | Use transaction-date exchange rate, not month-end rate | Month-end rate smooths away intra-month volatility that affects cash |
| FX gain/loss | Report separately below operating income | Mixing FX in revenue/COGS misleads on core business performance |
| Vietnamese market | VND has no minor unit (no cents) — round to whole numbers | Decimal VND amounts signal data quality issues to auditors |
| International payroll | Use loaded cost in local currency, convert at payroll-date rate | Budget rate vs. actual rate creates phantom variance |
