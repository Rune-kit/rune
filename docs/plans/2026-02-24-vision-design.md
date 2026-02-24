# Design: VISION.md for Rune

**Date:** 2026-02-24
**Status:** Implemented

## Context

Rune had README (marketing), ARCHITECTURE (technical), MESH-RULES (behavioral) but no document answering "why does Rune exist and where is it going?" — leading to potential direction drift across sessions.

## Requirements

- Internal compass for developer + AI sessions (primary)
- Public-ready for community/contributors (secondary)
- Must answer: identity, anti-goals, design principles, skill addition filter, roadmap, success metrics
- Must survive contact with scope creep requests

## Approach Chosen

**Decision Framework style (Approach B)** — structured around decision-making questions rather than prose. Each section is actionable, not decorative.

## Key Decisions

1. **The Bloat persona** — named antagonist representing scope creep. Makes anti-goals vivid and memorable rather than abstract rules.

2. **5-Gate Skill Addition Filter** — replaces vague "only add valuable skills" with a concrete checklist. Gates: lifecycle fit, ≥2 connections, non-redundancy, layer clarity, removal test.

3. **Anti-goals are explicit and specific** — 5 named anti-goals with real examples, not just "stay focused."

4. **Roadmap without dates** — H1/H2/H3 horizons with explicit constraints per horizon. Prevents The Bloat from using "roadmap" as justification for premature features.

5. **The Bloat's Greatest Hits appendix** — living log of rejected proposals with rejection reasons. Institutional memory against recurring proposals.

6. **Bloat Index metric** — dead nodes / total skills. Single number that captures mesh health.

## Output

- `docs/VISION.md` — primary document (~430 lines)
