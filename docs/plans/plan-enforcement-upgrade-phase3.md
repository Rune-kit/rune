# Phase 3: Compiler Compliance Transform

## Goal
Create a new compiler transform that injects a compliance preamble into every skill file when compiled for non-Claude platforms. This distributes enforcement to ALL platforms (Cursor, Windsurf, Antigravity, Codex, OpenCode) — no single point of failure.

## Tasks
- [ ] Create `compiler/transforms/compliance.js` — new transform module
- [ ] Register compliance transform in `compiler/transformer.js` pipeline
- [ ] Test build for cursor platform — verify preamble appears
- [ ] Test build for windsurf platform — verify preamble appears
- [ ] Run `node compiler/bin/rune.js doctor` — verify no regressions

## Code Contracts

### compliance.js Transform
```javascript
/**
 * Injects a compliance preamble after the first heading in every skill body.
 * Only for non-Claude platforms (Claude has native plugin enforcement).
 *
 * Preamble: 5-line reminder that every code response must route through a skill.
 */
export function transformCompliance(body, adapter) {
  const preamble = [
    '',
    '> **RUNE COMPLIANCE**: Before ANY code response, you MUST:',
    '> 1. Classify this request (CODE_CHANGE | QUESTION | DEBUG | REVIEW | EXPLORE)',
    '> 2. Route through the correct Rune skill (see skill-router routing table)',
    '> 3. Follow the skill\'s workflow — do NOT freelance or skip steps',
    '> Violation: writing code without skill routing = incorrect behavior.',
    '',
  ].join('\n');

  // Insert after first heading (# skill-name)
  const firstH2 = body.indexOf('\n## ');
  if (firstH2 !== -1) {
    return body.slice(0, firstH2) + preamble + body.slice(firstH2);
  }
  return body + preamble;
}
```

### transformer.js Integration
```
Pipeline order (updated):
1. frontmatter → 2. cross-refs → 3. tool-names → 4. subagents
→ 5. compliance (NEW) → 6. hooks → 7. branding

Insert compliance AFTER subagents, BEFORE hooks.
Only run for non-Claude adapters (already handled by transformer's
early-return for claude adapter).
```

## Acceptance Criteria
- [ ] `transforms/compliance.js` exists and exports `transformCompliance`
- [ ] `transformer.js` imports and calls compliance transform
- [ ] `rune build --platform cursor` outputs files with compliance preamble
- [ ] `rune build --platform windsurf` outputs files with compliance preamble
- [ ] `rune doctor` passes
- [ ] Claude adapter still returns body unchanged (no preamble for native plugin)

## Files Touched
- `compiler/transforms/compliance.js` — new
- `compiler/transformer.js` — modify (import + pipeline insertion)

## Dependencies
- Phase 1 complete (preamble references classifier types from skill-router)

## Cross-Phase Context
- Phase 1 defines the 5-type Request Classifier — preamble references these types
- Existing transforms pattern: see `transforms/branding.js` for reference implementation
