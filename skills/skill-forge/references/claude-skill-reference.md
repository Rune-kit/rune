# Claude Code Skill System Reference

> Loaded by `skill-forge` when creating or editing skills. Covers frontmatter fields, variables, shell injection, invocation control, and skill type patterns.

---

## Frontmatter Fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Kebab-case identifier. Becomes the `/slash-command`. Must match directory name. |
| `description` | string | What the skill does. Claude uses this for auto-activation matching. Include action verbs and trigger phrases. |

### Optional

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `argument-hint` | string | — | Shown in autocomplete after command name. Use `[brackets]`. |
| `user-invocable` | boolean | `true` | If `false`, no slash command — auto-activate only. |
| `auto-activate` | boolean | `true` | If `false`, slash command only — never auto-activates. |
| `allowed-tools` | string[] | all | Whitelist of tools the skill can use. |
| `disallowed-tools` | string[] | none | Blacklist of tools. |

### Invocation Control Matrix

| `user-invocable` | `auto-activate` | Behavior |
|-------------------|-----------------|----------|
| `true` (default) | `true` (default) | Full access: slash command + auto-activates |
| `true` | `false` | Slash command only, never auto-activates |
| `false` | `true` | Auto-activate only, no slash command |
| `false` | `false` | Never runs — avoid this combination |

---

## Variables

Replaced at invocation time before Claude sees the content.

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | Everything after `/command`. Empty if no arguments. |
| `$0` | Alias for `$ARGUMENTS` |
| `${CLAUDE_SKILL_DIR}` | Absolute path to skill directory. Use for referencing supporting files. |
| `${CLAUDE_SESSION_ID}` | Unique ID for current Claude Code session. |

**Usage in SKILL.md:**
```markdown
The user wants: $ARGUMENTS
Read `${CLAUDE_SKILL_DIR}/reference.md` for details.
```

---

## Shell Injection

Embed live command output using `` !`command` `` syntax:

```markdown
Current branch: !`git branch --show-current`
Node version: !`node --version`
Changed files: !`git diff main --name-only`
```

**How it works:**
- Commands execute when skill activates (not at definition time)
- Output replaces the `` !`command` `` inline
- Commands run in current working directory
- Keep commands fast — slow commands delay skill activation
- Don't use for side effects — skill content is for context, not execution

---

## Skill Type Patterns

### Task Skill (side effects)

Performs actions — deploy, commit, publish. Use `auto-activate: false` for destructive operations.

```yaml
---
name: deploy
description: Deploy application to production or staging. Use when user wants to deploy, ship, release.
argument-hint: [environment: staging|production]
auto-activate: false
---
```

### Research Skill (information gathering)

Gathers and synthesizes information. Uses Agent subagents for parallel research.

```yaml
---
name: deep-research
description: Perform deep research on a topic using web search and analysis.
argument-hint: [topic or question to research]
---
```

### Knowledge Skill (pure reference)

Provides reference context. Auto-activates when relevant, no slash command needed.

```yaml
---
name: api-conventions
description: API design conventions for this project. Use when writing API endpoints or reviewing API code.
user-invocable: false
---
```

### Dynamic Context Skill (live state)

Uses shell injection to inject current project state.

```markdown
Branch: !`git branch --show-current`
Changed files: !`git diff main --name-only`
```

---

## File Structure & Loading

```
skills/my-skill/
├── SKILL.md          # Required — loaded on activation
├── reference.md      # Optional — read on-demand via ${CLAUDE_SKILL_DIR}
├── examples.md       # Optional — read on-demand
└── scripts/          # Optional — bundled scripts, never auto-loaded
```

**Loading behavior:**
- **SKILL.md**: Always loaded when skill activates
- **Supporting `.md` files**: NOT auto-loaded. Only read when SKILL.md references them via `${CLAUDE_SKILL_DIR}`
- **Scripts**: Available on disk, never auto-loaded

This means: keep SKILL.md focused (under 300 lines), put detailed references in separate files that load lazily.

---

## Skill Quality Checklist

1. **Name**: kebab-case, matches directory name
2. **Description**: includes trigger phrases Claude can match against
3. **SKILL.md under 300 lines**: move details to reference files
4. **Supporting files referenced via `${CLAUDE_SKILL_DIR}`**: never hardcode paths
5. **`$ARGUMENTS` used for user input**: contains everything after slash command
6. **One skill per concern**: don't bundle unrelated functionality
7. **Templates are minimal**: show patterns, not complete applications
8. **Tool restrictions only when safety-critical**: don't over-constrain

---

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Giant monolith SKILL.md (>300 lines) | Split into supporting reference files |
| Vague description ("Helps with stuff") | Action-oriented with trigger phrases |
| Hardcoded paths to supporting files | Use `${CLAUDE_SKILL_DIR}` |
| Over-engineering frontmatter | Most skills only need name + description |
| Duplicating built-in Claude behavior | Only create skills for project-specific patterns |
| Missing argument-hint | Users won't know what to type after `/command` |

---

## Rune-Specific Conventions

When creating Rune skills (vs generic Claude Code skills):

| Field | Rune Convention |
|-------|----------------|
| Frontmatter | Add `metadata:` block with author, version, layer, model, group, tools |
| Layer | L0 (router), L1 (orchestrator), L2 (workflow), L3 (utility), L4 (extension pack) |
| Connections | Document `Calls` (outbound) and `Called By` (inbound) sections |
| Model | haiku (scan), sonnet (code), opus (architecture) |
| Version | semver — bump on enrichment |
| References | Store in `references/` subdirectory |
| Cross-references | Use `rune:skill-name` syntax |
