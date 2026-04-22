<!-- Thanks for contributing to Rune! Fill the checklist below. -->

## What does this PR do?

<!-- One sentence. Prefer "adds X" / "fixes Y" / "refactors Z" over "updates stuff". -->

## Why?

<!-- What problem does this solve? Link an issue if applicable: Fixes #123 -->

## Type

- [ ] New skill
- [ ] New extension pack
- [ ] Enrichment to existing skill/pack
- [ ] Bug fix
- [ ] Docs
- [ ] Compiler / platform adapter
- [ ] CI / tooling
- [ ] Breaking change (explain below)

## Layer (if adding or modifying a skill)

- [ ] L0 (skill-router)
- [ ] L1 (orchestrator)
- [ ] L2 (workflow hub)
- [ ] L3 (utility)
- [ ] L4 (extension pack)

## Mesh impact

- [ ] Added/changed `emit:` or `listen:` signals — documented in [`docs/SIGNALS.md`](../docs/SIGNALS.md)
- [ ] No mesh impact

## Checklist

- [ ] `npm test` passes locally
- [ ] `npm run lint` passes (or `npm run lint:fix` applied)
- [ ] `node scripts/validate-skills.js` passes
- [ ] `node scripts/validate-signals.js` passes (if signals changed)
- [ ] `node scripts/validate-mesh.js` passes (if connections changed)
- [ ] For new skills: `SKILL.md` follows [`docs/SKILL-TEMPLATE.md`](../docs/SKILL-TEMPLATE.md)
- [ ] For new packs: `PACK.md` follows [`docs/EXTENSION-TEMPLATE.md`](../docs/EXTENSION-TEMPLATE.md)
- [ ] Version bumped in `package.json` if shipping a new release
- [ ] `CHANGELOG.md` entry added for user-visible changes

## Breaking changes

<!-- If this is a breaking change, describe:
     - what breaks
     - migration path for users on the previous version
     - why the break is necessary
-->

## Additional notes

<!-- Anything reviewers should know. Screenshots, perf numbers, related PRs, etc. -->
