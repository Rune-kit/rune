# ba — Ambiguity scoring

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Scoring Formula

```
Ambiguity = 1 - weighted_average(dimensions)

Dimensions (weights vary by requirement type):
  Greenfield:  Goal (40%) + Constraints (30%) + Success Criteria (30%)
  Feature:     Goal (30%) + Constraints (30%) + Success Criteria (20%) + Integration (20%)
  Integration: Goal (20%) + Constraints (25%) + Success Criteria (20%) + API Contract (35%)
```

#### Dimension Scoring (0.0 – 1.0)

| Dimension | 0.0 (Unknown) | 0.5 (Partial) | 1.0 (Clear) |
|-----------|---------------|----------------|--------------|
| **Goal** | "Make it better" | "Improve dashboard performance" | "Dashboard loads in <2s with 10k rows" |
| **Constraints** | No constraints mentioned | "Use existing DB" | "PostgreSQL 15, no new deps, GDPR compliant" |
| **Success Criteria** | "It should work" | "Users can see their data" | "AC-1.1: GIVEN 10k rows WHEN page loads THEN render <2s" |
| **Integration** | "Connect to the API" | "Use REST, need auth" | "POST /api/v2/orders, OAuth2, rate limit 100/min" |
| **API Contract** | "It sends data somewhere" | "JSON payload to endpoint" | "OpenAPI spec provided, request/response schemas defined" |

#### Scoring After Each Question

After each of the 5 Questions (Step 2), update the score:

```
Round 1 (WHO):    Goal ≈ 0.3, others = 0.0 → Ambiguity ≈ 91%
Round 2 (WHAT):   Goal ≈ 0.7, Success ≈ 0.3 → Ambiguity ≈ 72%
Round 3 (WHY):    Goal ≈ 0.9, Success ≈ 0.5 → Ambiguity ≈ 47%
Round 4 (BOUNDS): Constraints ≈ 0.6 → Ambiguity ≈ 30%
Round 5 (CONSTR): Constraints ≈ 0.9 → Ambiguity ≈ 12% ✅
```

If Ambiguity drops below 15% before all 5 questions are asked (e.g., user provides a detailed PRD), skip remaining questions and proceed. The gate is about clarity, not ceremony.

#### Display Format

After completing Step 2, show the user:

```
Clarity Score: [100 - ambiguity]%
  Goal:             [██████████] 0.9
  Constraints:      [████████░░] 0.8
  Success Criteria: [██████░░░░] 0.6  ← weakest
  Status: ACCEPTABLE (ambiguity 23%) — proceeding with noted gaps
```
