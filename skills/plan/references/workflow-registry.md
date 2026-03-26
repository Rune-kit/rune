# Workflow Registry (4-View)

> Reference for `plan` skill — Step 4.5.
> Load this when building a Workflow Registry for complex features (4+ phases OR 3+ user-facing workflows).

## When to Use

Build this registry BEFORE writing phase files for complex features. It catches missing pieces, dead ends, and integration gaps at plan time — not implementation time.

**Skip conditions**: trivial tasks, inline plans, single-workflow features.


## 4-View Format

```markdown
## Workflow Registry

### View 1: By Workflow
| Workflow | Entry Point | Components Touched | Exit Point | Phase |
|----------|-------------|-------------------|------------|-------|
| User signup | POST /auth/register | AuthService, UserRepo, EmailService | 201 + email sent | Phase 1 |
| Password reset | POST /auth/reset | AuthService, EmailService, TokenRepo | 200 + reset email | Phase 2 |

### View 2: By Component
| Component | Used By Workflows | Owner Phase | Status |
|-----------|-------------------|-------------|--------|
| AuthService | signup, login, reset | Phase 1 | Planned |
| EmailService | signup, reset, invite | Phase 2 | Planned |
| TokenRepo | reset, invite | Phase 2 | Missing ← RED FLAG |

### View 3: By User Journey
| Journey | Steps (workflow chain) | Happy Path | Error Path |
|---------|----------------------|------------|------------|
| New user → first action | signup → verify email → login → onboard | 4 steps | signup fail, email bounce |

### View 4: By State
| Step | User Sees | DB State | Logs | Operator Sees |
|------|-----------|----------|------|---------------|
| After signup | "Check your email" | user.status=pending | user.created event | New user in admin |
| After verify | Dashboard | user.status=active | user.verified event | Active user count +1 |
```

## Validation Rules

- Every component in View 2 MUST appear in at least one workflow in View 1 — orphaned components = dead code
- Every workflow in View 1 MUST map to a phase — unphased workflows will be forgotten
- **"Missing" status in View 2 = red flag** — component needed but not planned in any phase → add to a phase or create new phase
- Every user journey step in View 3 MUST have a corresponding state row in View 4

## Output Placement

Add the registry to the master plan file (it fits within the 80-line budget when tables are compact). Phase files reference it but don't duplicate it.
