> Activate when: agent needs to parse a policy document and auto-enforce structured constraints before commit, tool use, or code generation.

# Policy-Driven Constraints

Sentinel normally requires a developer to manually configure what is blocked. Policy-driven constraints flip that: upload a document — security policy, compliance requirements, team standards — and Sentinel parses it into enforced rules automatically.

---

## 1. The Pattern: Document → Constraints

**Traditional flow:**
Developer writes constraint config → commits it → Sentinel enforces it.

**Policy-driven flow:**
Team uploads existing policy doc (often already written for audit purposes) → LLM parses structured rules → Sentinel enforces them immediately, with no manual translation.

**Why this matters:**
- Compliance docs already exist. They should not need to be re-expressed as code.
- Rules stay in sync: update the policy doc → re-parse → constraints update.
- Non-engineers can author constraints by writing plain policy documents.

**Production use cases:**
- Security policy → agent cannot write code that logs PII fields
- Data handling requirements → agent blocks unencrypted data storage patterns
- Team coding standards → agent enforces style and structure rules
- Temporary lockdown doc → agent restricted to read-only operations during incident

---

## 2. Policy Document Parsing Pipeline

```
[Policy Document]
     ↓
[1. Ingest] — markdown, PDF, plain text, or URL
     ↓
[2. Extract] — LLM identifies constraint candidates
     ↓
[3. Structure] — normalize to Constraint Schema (below)
     ↓
[4. Validate] — check for conflicts, missing patterns, ambiguous scope
     ↓
[5. Persist] — save to .rune/sentinel/policies/[policy-name].yaml
     ↓
[6. Activate] — Sentinel loads on every check cycle
```

**Step 2 prompt pattern (internal):**
```
Read the following policy document and extract all rules that restrict, require,
or warn about specific actions, code patterns, or data handling.
For each rule, output a structured constraint using the schema below.
Ignore procedural text, approvals, and organizational information.
```

**Constraint Schema:**
```yaml
- id: constraint-001
  source: "Security Policy v3.2, Section 4.1"
  type: block | warn | require
  scope: file_pattern | tool | output | code_pattern
  rule: "description of what is blocked/warned/required"
  pattern: "regex or glob if applicable"
  severity: critical | high | medium | low
  active: true
```

**Persisted policy file location:**
```
.rune/sentinel/policies/
  security-baseline.yaml
  code-quality.yaml
  compliance-soc2.yaml
  [custom-policy-name].yaml
```

---

## 3. Constraint Types

### block — hard stop

Agent cannot proceed. Action is rejected with explanation.

```yaml
- id: block-001
  type: block
  scope: file_pattern
  rule: "Never commit credential or secret files"
  pattern: "**/{*.env,.env*,*credentials*,*secret*,*.pem,*.key}"
  severity: critical

- id: block-002
  type: block
  scope: code_pattern
  rule: "No hardcoded API keys or tokens in source"
  pattern: "(sk-|pk-|AIza|AKIA|ghp_)[A-Za-z0-9]{16,}"
  severity: critical

- id: block-003
  type: block
  scope: code_pattern
  rule: "No eval() — remote code execution risk"
  pattern: "\\beval\\s*\\("
  severity: high

- id: block-004
  type: block
  scope: code_pattern
  rule: "No SQL string concatenation — injection risk"
  pattern: "(query|sql)\\s*[+]=.*\\$\\{|f['\"].*SELECT.*\\{"
  severity: critical

- id: block-005
  type: block
  scope: tool
  rule: "No force-push to protected branches"
  pattern: "git push --force"
  severity: critical
```

### warn — flag but allow

Sentinel surfaces the issue. Human decides whether to proceed.

```yaml
- id: warn-001
  type: warn
  scope: code_pattern
  rule: "TODO/FIXME comments should not ship in committed code"
  pattern: "\\b(TODO|FIXME|HACK|XXX)\\b"
  severity: low

- id: warn-002
  type: warn
  scope: output
  rule: "Functions exceeding 100 lines reduce maintainability"
  pattern: "function_length > 100"
  severity: medium

- id: warn-003
  type: warn
  scope: code_pattern
  rule: "Async functions without error handling may fail silently"
  pattern: "async\\s+\\w+[^{]*\\{(?![\\s\\S]*try)"
  severity: medium
```

### require — must be present before proceeding

Agent is blocked until the required artifact exists.

```yaml
- id: require-001
  type: require
  scope: output
  rule: "Every new function must have a corresponding test"
  pattern: "test_file_exists_for_new_functions"
  severity: high

- id: require-002
  type: require
  scope: code_pattern
  rule: "All Python functions must have type hints"
  pattern: "def \\w+\\([^)]*:\\s*\\w"
  severity: medium

- id: require-003
  type: require
  scope: file_pattern
  rule: "User-facing changes require a CHANGELOG entry"
  pattern: "CHANGELOG.md"
  severity: medium
```

---

## 4. Scope Resolution

How Sentinel matches a constraint against an agent action:

| Scope | Matches Against | Example |
|-------|----------------|---------|
| `file_pattern` | Glob on paths being created/edited/deleted | `**/*.env` |
| `tool` | Tool name + arguments being invoked | `Bash` with `rm -rf` |
| `output` | Full text of code being written | scan for `eval(` |
| `code_pattern` | Regex against generated code diff | `SELECT.*\+.*userId` |

**Priority order when multiple constraints match:**
```
block > require > warn
```

**Multiple policies stacking:**
All active policy files in `.rune/sentinel/policies/` are loaded and merged. Constraints with the same `id` in a project-level policy override org-level. All `block` constraints from any policy are enforced — there is no way to un-block at a lower tier.

**Conflict resolution:**
If two policies disagree (one requires a pattern, another blocks it), Sentinel halts and surfaces the conflict. It does not silently pick a winner.

---

## 5. Dynamic Skill Disabling

A policy document can disable entire Rune skills, not just code patterns.

**How it works:**
1. Policy document states a prohibition (e.g., "no automated deployments during freeze")
2. Parser extracts a `disable_skill` directive
3. Sentinel checks active disabled-skills list before skill-router routes any task
4. Disabled skill returns a structured refusal explaining the policy source

**Disabled skills config:**
```yaml
# .rune/sentinel/disabled-skills.yaml
disabled:
  - skill: rune:deploy
    reason: "Code freeze in effect — Security Policy v4, Section 2.3"
    policy_source: "compliance-soc2.yaml"
    expires: "2026-04-15T00:00:00Z"  # optional

  - skill: rune:db
    reason: "Production database access restricted to SRE team only"
    policy_source: "security-baseline.yaml"
    expires: null  # permanent until policy updated
```

**Refusal message format (returned to agent):**
```
Skill rune:deploy is currently disabled.
Reason: Code freeze in effect — Security Policy v4, Section 2.3
Source: compliance-soc2.yaml
To re-enable: update or remove the policy, or wait for expiry (2026-04-15).
```

---

## 6. Policy Lifecycle

**Versioning:**
Each policy file includes a version field. Re-parsing a document creates a new version; previous versions are retained in `.rune/sentinel/policies/history/`.

```yaml
# Header of every policy file
meta:
  policy_name: security-baseline
  version: "1.2.0"
  parsed_from: "docs/security-policy.md"
  parsed_at: "2026-03-31T10:00:00Z"
  active: true
  expires: null
```

**Override hierarchy:**
```
org-level (default) → project-level (overrides org) → session-level (temporary)
```
Configurable per project in `.rune/config.yaml` via `policy_override_direction`.

**Expiry:**
Policies and individual constraints support `expires` timestamps. Sentinel checks expiry on load and deactivates expired rules automatically. Useful for temporary incident lockdowns.

**Audit trail:**
Every enforcement event is appended to `.rune/sentinel/audit.log`:
```
2026-03-31T10:42:11Z | BLOCK | constraint-002 | Bash | "git push --force origin main" | security-baseline v1.2.0
2026-03-31T10:43:05Z | WARN  | warn-001 | Edit | src/api/users.ts | TODO comment on line 47
```

---

## 7. Bootstrap Policies

Ready-to-use templates. Copy to `.rune/sentinel/policies/` to activate.

**security-baseline.yaml:**
```yaml
meta:
  policy_name: security-baseline
  version: "1.0.0"
  active: true
constraints:
  - id: sb-001
    type: block
    scope: file_pattern
    rule: "No credential or secret files committed"
    pattern: "**/{*.env,.env*,*credentials*,*secret*,*.pem,*.key,*.p12}"
    severity: critical
  - id: sb-002
    type: block
    scope: code_pattern
    rule: "No hardcoded secrets"
    pattern: "(password|api_key|secret|token)\\s*=\\s*['\"][^'\"]{8,}"
    severity: critical
  - id: sb-003
    type: block
    scope: code_pattern
    rule: "No eval() usage"
    pattern: "\\beval\\s*\\("
    severity: high
  - id: sb-004
    type: block
    scope: code_pattern
    rule: "No SQL string concatenation"
    pattern: "f['\"]\\s*SELECT|['\"]\\s*\\+\\s*(user|id|input)"
    severity: critical
  - id: sb-005
    type: block
    scope: tool
    rule: "No force-push"
    pattern: "push --force"
    severity: critical
```

**code-quality.yaml:**
```yaml
meta:
  policy_name: code-quality
  version: "1.0.0"
  active: true
constraints:
  - id: cq-001
    type: warn
    scope: code_pattern
    rule: "No TODO/FIXME in committed code"
    pattern: "\\b(TODO|FIXME|HACK)\\b"
    severity: low
  - id: cq-002
    type: require
    scope: output
    rule: "New functions require tests"
    pattern: "test_coverage_for_new_symbols"
    severity: high
  - id: cq-003
    type: require
    scope: code_pattern
    rule: "Python functions require type hints"
    pattern: "def \\w+\\("
    severity: medium
  - id: cq-004
    type: warn
    scope: code_pattern
    rule: "No print() in production Python — use logger"
    pattern: "\\bprint\\s*\\("
    severity: medium
```

**compliance-soc2.yaml:**
```yaml
meta:
  policy_name: compliance-soc2
  version: "1.0.0"
  active: true
constraints:
  - id: soc2-001
    type: block
    scope: code_pattern
    rule: "No PII fields in logs — email, SSN, card numbers"
    pattern: "log(ger)?\\.(info|debug|warn|error).*\\b(email|ssn|card_number|password)\\b"
    severity: critical
  - id: soc2-002
    type: block
    scope: code_pattern
    rule: "No unencrypted data-at-rest patterns"
    pattern: "open\\([^)]+,\\s*['\"]w['\"]\\)(?![\\s\\S]{0,200}encrypt)"
    severity: critical
  - id: soc2-003
    type: require
    scope: output
    rule: "All data access must be logged for audit trail"
    pattern: "audit_log_present_for_data_access"
    severity: high
  - id: soc2-004
    type: block
    scope: code_pattern
    rule: "No debug endpoints in production code"
    pattern: "route.*/(debug|test|dev)\\b"
    severity: high
```

---

## Signal Integration

```yaml
skill: sentinel
version: "0.9.0"

signals:
  emit:
    - sentinel.constraint.blocked
        # payload: { constraint_id, scope, matched_pattern, action_attempted, policy_source }
    - sentinel.constraint.warned
        # payload: { constraint_id, scope, message, severity }
    - sentinel.constraint.required_missing
        # payload: { constraint_id, missing_artifact, blocking_action }
    - sentinel.policy.loaded
        # payload: { policy_name, version, constraint_count, active }
    - sentinel.policy.expired
        # payload: { policy_name, expired_at }
    - sentinel.skill.disabled
        # payload: { skill, reason, policy_source, expires }
    - sentinel.audit.logged
        # payload: { event_type, constraint_id, tool, detail, timestamp }

  listen:
    - cook.phase.starting
        # re-run constraint load in case policies changed between phases
    - skill_router.skill.requested
        # intercept before routing — check disabled-skills list
    - preflight.check.requested
        # piggyback on preflight to surface active policy summary
    - scaffold.file.creating
        # validate new file paths against file_pattern constraints before write

  triggers:
    - on: pre_commit
      action: run all block + require constraints against staged diff
    - on: tool_use
      action: check tool constraints before allowing Bash/Write/Edit invocation
    - on: policy_file_changed
      action: reload active constraint set, emit sentinel.policy.loaded
    - on: session_start
      action: load all active policies, log count, warn on expired entries
```
