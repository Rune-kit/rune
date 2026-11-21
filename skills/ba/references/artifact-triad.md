# ba — Artifact triad and glossary sharpen

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 7 — Artifact Triad

Produce three structured artifacts — not one prose doc. Plan consumes all three; each answers a different question.

| Artifact | Question Answered | Consumer |
|----------|-------------------|----------|
| `requirements.md` | WHAT to build and WHY | plan, cook |
| `requirements.mermaid` | WHAT does the flow look like visually | plan, design, review |
| `tasks.md` | WHAT work layers exist | plan (as task backbone, not from scratch) |

#### Artifact 1: requirements.md

> Full detail moved to [`references/artifact-templates.md`](artifact-templates.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:plan`.

#### Artifact 2: requirements.mermaid

> Full detail moved to [`references/artifact-templates.md`](artifact-templates.md) (progressive disclosure). **Read that file before executing this section.**

#### Artifact 3: tasks.md

> Full detail moved to [`references/artifact-templates.md`](artifact-templates.md) (progressive disclosure). **Read that file before executing this section.**

#### Handoff

Emit signal to `plan` with paths to all three artifacts. Plan MUST read all three before producing phase files — the triad is the contract.

### Step 7.5 — Glossary Sharpen (CONTEXT.md update)

After the artifact triad is saved, append/update the project glossary `CONTEXT.md` with any domain terms that were sharpened during this session.

1. Determine glossary location:
   - If `CONTEXT-MAP.md` exists at root → multi-context; pick the right per-context CONTEXT.md
   - Else if root `CONTEXT.md` exists → use it
   - Else if any term needs recording → create root `CONTEXT.md` lazily
   - Else → skip silently (no-op when no terms emerged)
2. For each new term, add a row to the **Language** table (term, definition, aliases-to-avoid, status).
3. For each user-asserted relationship, add to the **Relationships** section.
4. For each ambiguity surfaced during elicitation, add to **Flagged ambiguities**.

**Conflict gate** — if a new term has ≥0.7 token overlap with an existing one, surface to user (merge / rename / keep distinct). NEVER silently re-define an existing term.

Format reference: [references/context-md-format.md](context-md-format.md).
