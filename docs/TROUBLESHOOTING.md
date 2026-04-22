# Troubleshooting

> Can't find your issue here? Check [GitHub Issues](https://github.com/rune-kit/rune/issues) or ask on [Telegram](https://t.me/xlabs_updates).

## Install & Setup

### `npx @rune-kit/rune init` fails on Windows
**Symptom:** `EPERM` or `access denied` error during init.
**Fix:** Run terminal as Administrator, OR install globally: `npm i -g @rune-kit/rune && rune init`.
**Root cause:** npm sometimes can't write to `.claude/` or `.cursor/` under restricted user contexts.

### `npx @rune-kit/rune init` doesn't detect my AI assistant
**Symptom:** Detects wrong assistant or prompts for manual choice.
**Fix:** Force the target: `npx @rune-kit/rune init --platform claude` (or `cursor`, `windsurf`, `antigravity`, `codex`, `opencode`).
**Full list:** `rune init --help`.

### Doctor reports "skills mismatch" after upgrading
**Symptom:** `rune doctor` flags `X skills expected, Y found`.
**Fix:** Re-run init to regenerate: `npx @rune-kit/rune init --force`. This overwrites platform-specific files without touching your `.rune/` state.

### "Command not found: rune"
**Fix:** Either (a) use `npx @rune-kit/rune` prefix, or (b) install globally: `npm i -g @rune-kit/rune`.

---

## Skills Not Firing

### `/rune cook` doesn't run in Claude Code
**Checklist:**
1. Is `.claude/plugin.json` present? Run `ls .claude/` — if empty, re-run `rune init`.
2. Did you reload Claude Code? Type `/plugins` in Claude to confirm Rune is loaded.
3. Check `.claude-plugin/plugin.json` version — should match your installed Rune version.

### Cursor/Windsurf/Antigravity: skill invocations ignored
**Symptom:** You type `@rune:cook` or `/rune cook` but nothing happens.
**Fix:** These IDEs use different prefixes. Rune writes the correct format during `init`.
- Cursor: Skills appear as `.cursor/rules/*.mdc` — invoke by describing intent
- Windsurf: `.windsurf/workflows/*.md` — invoke via workflow menu
- Antigravity: `.antigravity/workflows/*.md` — beta support

If files exist but IDE ignores them, check IDE's "reload workspace" option.

### Auto-discipline hooks not firing
**Symptom:** Installed `rune hooks install --preset gentle` but preflight/sentinel never run.
**Checklist:**
1. `rune hooks status` — verify hooks are registered for your IDE
2. Claude Code: hooks fire on tool use, not chat messages. Try editing a file.
3. Uninstall and reinstall: `rune hooks uninstall && rune hooks install --preset gentle`.
4. Strict mode blocking something? Check `.rune/hooks.log` for last error.

---

## Mesh & Signals

### `node scripts/validate-signals.js` reports orphan listener
**Symptom:** `skill X listens to 'foo.bar' but no skill emits it`.
**Fix:** Either (a) add `emit: foo.bar` to the intended emitter, or (b) add `foo.bar` to `INTENTIONAL_BROADCAST_SIGNALS` in `scripts/validate-signals.js` with a comment explaining why.
**Reference:** [`SIGNALS.md`](SIGNALS.md) for the canonical signal catalog.

### Signal name rejected by validator
**Cause:** Names must be `lowercase.dot.separated` — no camelCase, no underscores.
**Good:** `code.changed`, `preflight.passed`, `db.migrated`
**Bad:** `codeChanged`, `code_changed`, `Code.Changed`

### Pro/Business skills don't stack on Free
**Symptom:** Installed Pro tier but hooks only show Free skills.
**Fix:** `rune hooks install --preset gentle --tier pro` (or `--tier business`). Tier stacking is opt-in.

---

## Tests / CI

### `npm test` fails with "Cannot find module"
**Fix:** `npm ci` (clean install from `package-lock.json`). If that fails, delete `node_modules` and `package-lock.json`, then `npm install`.

### Tests pass locally but fail in CI
**Common causes:**
1. **Node version mismatch** — CI uses Node 18, 20, 22. Check which fails: `.github/workflows/ci.yml`
2. **Path separators** — Windows uses `\`, Unix uses `/`. Use `path.join()` always.
3. **Line endings** — CRLF vs LF. Ensure `.gitattributes` normalizes.

### Linter complains after I pulled from main
**Fix:** `npm run lint:fix` (Biome auto-fixes most issues). Then re-run `npm run lint`.

---

## Pack Building

### `rune build` emits wrong platform
**Fix:** Pass `--platform` explicitly: `rune build --platform cursor --output ../my-project`.

### Pack publish fails with "tier resolution conflict"
**Symptom:** Pro pack references a Free skill that was overridden.
**Fix:** Rune's tier resolver prefers Pro/Business over Free. If a Pro skill has the same name as a Free skill, the Pro one wins. Rename or remove the Free-tier duplicate.
**Reference:** [`ARCHITECTURE.md`](ARCHITECTURE.md) § Tier Override.

---

## Common Errors & Meaning

| Error | Meaning | Fix |
|-------|---------|-----|
| `SKILL.md missing frontmatter` | Skill file has no `---` YAML block | Add frontmatter per [`SKILL-TEMPLATE.md`](SKILL-TEMPLATE.md) |
| `layer must be L0\|L1\|L2\|L3` | Frontmatter `layer` field invalid | Fix to one of L0/L1/L2/L3 |
| `orphan connection: X` | Skill references non-existent skill X | Remove the `rune:X` ref or add skill X |
| `pack.json schema invalid` | PACK.md has bad JSON metadata | Run `rune doctor --fix` |
| `hooks install failed: EACCES` | Can't write to IDE config | Run with elevated permissions or use `--dry-run` to see what would change |

---

## Performance

### Rune makes Claude slower
**Symptom:** Tasks take longer with Rune than without.
**Expected behavior:** For simple tasks (<200 LOC), Rune may be 5-15% slower due to scout + test overhead. For complex tasks (1000+ LOC refactors), Rune is typically 30-60% faster due to discipline preventing rework.
**If much slower:** Check if `verification` is running a huge test suite on every edit. Consider `hooks install --preset gentle` instead of `strict`.

### Session context window fills up fast
**Fix:** Rune auto-checkpoints via `session-bridge`. If that's not enough:
1. `/clear` in Claude Code, then `rune onboard` to reload `.rune/` state
2. Break work into phases (each phase = 1 session)
3. Upgrade to Pro for `autopilot` skill — autonomous multi-session execution

---

## Still Stuck?

- **GitHub Issues:** https://github.com/rune-kit/rune/issues (use the bug template)
- **Telegram:** https://t.me/xlabs_updates (faster response for questions)
- **Docs:** [`ARCHITECTURE.md`](ARCHITECTURE.md), [`SIGNALS.md`](SIGNALS.md), [`SKILLS.md`](SKILLS.md)

When filing a bug, include:
- Rune version (`rune --version`)
- Platform (Claude Code / Cursor / Windsurf / etc.)
- Node version (`node --version`)
- Exact command that failed
- Output of `rune doctor`
