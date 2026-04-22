# Getting Started — Your First 5 Minutes with Rune

> New to Rune? This guide takes you from zero to your first disciplined feature ship in under 5 minutes.

**What you'll learn:**
1. Install Rune in your project
2. Run your first `/rune cook` to ship a real feature
3. Understand what just happened (and why it was different from "vanilla" AI coding)

---

## Prerequisites

- **Node.js 18+** (check: `node --version`)
- One of: **Claude Code**, **Cursor**, **Windsurf**, **Google Antigravity**, **OpenAI Codex**, or **OpenCode**
- A project directory — existing or empty

---

## Step 1: Install (30 seconds)

From your project root:

```bash
npx @rune-kit/rune init
```

This detects your AI assistant and writes the right config files:

| Assistant | What Rune writes |
|-----------|------------------|
| Claude Code | `.claude/` (plugin), skills invoke via `/rune <name>` |
| Cursor | `.cursor/rules/*.mdc` |
| Windsurf | `.windsurf/workflows/*.md` |
| Antigravity | `.antigravity/workflows/*.md` |
| Codex | `.codex/skills/` |
| OpenCode | `.opencode/skills/` |

Verify install:

```bash
npx @rune-kit/rune doctor
```

You should see: `✓ 62 skills, 14 packs, mesh valid`.

---

## Step 2: Your First `/rune cook` (3 minutes)

Open your AI assistant in the project and ask:

> `/rune cook add a health check endpoint at /api/health that returns { status: "ok", uptime }`

Watch what happens:

```
[cook] Starting feature implementation...
  ↳ [scout] Scanning codebase... Found Express app at src/server.js
  ↳ [plan] Drafting phase plan... Single-phase (small task)
  ↳ [test] Writing failing tests first (TDD RED)...
       src/__tests__/health.test.js — 3 tests FAIL ✓
  ↳ [fix] Implementing src/routes/health.js...
       Re-run tests → 3/3 PASS ✓ (TDD GREEN)
  ↳ [preflight] Checking logic, regressions, completeness... PASSED ✓
  ↳ [sentinel] Secret scan, OWASP top 10... PASSED ✓
  ↳ [verification] npm run test + lint + build... ALL PASS ✓
  ↳ [git] Committing: feat: add /api/health endpoint with uptime
```

That's **the mesh in action**. Six skills cooperated — you didn't invoke any of them directly.

---

## Step 3: What Just Happened?

Compare vanilla AI coding vs Rune:

| Vanilla | With Rune |
|---------|-----------|
| Claude writes code first | `scout` reads codebase first |
| Tests written last (or skipped) | `test` writes FAILING tests first (enforced) |
| Commit whenever | `preflight` + `sentinel` must pass |
| "Looks done" = done | `completion-gate` validates evidence |

**The mesh makes Claude disciplined.** Not smarter — just less sloppy.

---

## Step 4: Turn On Auto-Discipline (optional but recommended)

By default, Rune skills only run when you invoke them. To auto-fire quality gates on every tool use:

```bash
npx @rune-kit/rune hooks install --preset gentle
```

Presets:
- `gentle` (default) — warnings, not blocks
- `strict` — blocks commits that fail gates
- `off` — uninstall

Now `preflight`, `sentinel`, and `completion-gate` auto-fire on every file edit. No more "remember to invoke the skill."

---

## Step 5: Explore the Mesh

```bash
npx @rune-kit/rune status       # project health dashboard (neofetch-style)
npx @rune-kit/rune visualize    # interactive mesh graph (Canvas 2D)
npx @rune-kit/rune doctor       # validate install + mesh integrity
```

Read next:
- [`SKILLS.md`](SKILLS.md) — all 62 skills, categorized by intent
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — 5-layer architecture reference
- [`SIGNALS.md`](SIGNALS.md) — how skills auto-trigger each other
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — stuck? common fixes here

---

## Common First-Day Questions

**Q: Do I invoke skills by name or just talk to Claude?**
A: Both work. `/rune cook add login` is explicit. "Add login to the app" works too — `skill-router` picks the right skill. Explicit is faster.

**Q: What if I already have skills/prompts set up?**
A: Rune writes to its own namespace (`.rune/`, `.claude/plugins/rune/`, etc.). Your existing setup is untouched. Uninstall cleanly with `rune hooks uninstall`.

**Q: Does Rune work offline?**
A: Yes. All skills are local Markdown. Only `research`, `docs-seeker`, `trend-scout` need network.

**Q: How do I get Pro/Business skills?**
A: See [pricing](https://rune-kit.github.io/rune#pricing). Pro adds product/sales/data/support/growth packs ($49 lifetime). Business adds finance/legal/HR/enterprise-search ($149 lifetime).

**Q: I hit a bug. Where do I report it?**
A: [GitHub Issues](https://github.com/rune-kit/rune/issues) with the template. For faster help: [Telegram](https://t.me/xlabs_updates).

---

## Next Steps

1. **Build something real** — `/rune cook` a feature you were already going to build this week
2. **Compare with/without** — run the same task with Rune disabled, measure tokens + correctness
3. **Star the repo** if it helps — [github.com/rune-kit/rune](https://github.com/rune-kit/rune)
4. **Join the community** — [Telegram updates channel](https://t.me/xlabs_updates)

Welcome to disciplined AI coding.
