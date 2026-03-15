# Rune Demo Video — Production Plan

**Topic**: Rune plugin full demo — install to debug to ship
**Audience**: Developers using AI coding assistants (Claude Code, Cursor, Windsurf)
**Duration**: 180 seconds (3 minutes)
**Platform**: YouTube (primary), Twitter/X (60s cut), GitHub README (embedded)
**Style**: Screen recording + narration overlay, dark terminal theme

---

## Script (with timing marks)

### HOOK (0:00–0:08)

> "You're debugging for the 4th time. Claude keeps suggesting the same fix. Same loop. Same frustration."
> [Screen: terminal showing repeated failed attempts]
> "What if your AI assistant had a structured workflow that actually worked?"

### INTRO (0:08–0:20)

> "This is Rune — a 57-skill mesh that turns your AI coding assistant from a chatbot into an engineering team."
> [Screen: Rune GitHub page, star count, "57 skills | 200+ connections"]
> "It works on Claude Code, Cursor, Windsurf, and Antigravity. Let me show you."

### SCENE 1: INSTALL (0:20–0:40)

> "Install takes 10 seconds."
> [Screen: terminal]
> ```
> claude plugin install rune-kit/rune
> ```
> [Plugin installs, shows "57 skills loaded"]
> "For Cursor or Windsurf, one command compiles all skills into your IDE's format."
> [Screen: terminal]
> ```
> npx --yes @rune-kit/rune init --platform cursor
> ```
> [Shows files being generated]

### SCENE 2: ONBOARD (0:40–1:00)

> "First thing — let Rune understand your project."
> [Screen: terminal in a real project directory]
> ```
> /rune onboard
> ```
> [Shows scout scanning files, detecting Next.js + Prisma + TypeScript]
> [Shows .rune/ directory being created with decisions.md, conventions.md]
> "Rune scans your codebase, detects your stack, and creates context files that persist across sessions. No more re-explaining your project every time."

### SCENE 3: DEBUG (1:00–1:30)

> "Now let's debug. Users report login returns 401 for valid credentials."
> [Screen: terminal]
> ```
> /rune debug "login returns 401 for valid credentials"
> ```
> [Shows debug skill activating]
> [Shows scout finding auth files → debug reading them → identifying root cause]
> "Rune's debug skill traces the code path, finds the root cause — an expired JWT secret rotation — and hands it to fix."
> [Shows fix skill writing the code change]
> [Shows verification running: lint pass, typecheck pass, tests pass]
> "Fixed. Verified. One command."

### SCENE 4: BUILD A FEATURE (1:30–2:15)

> "Now let's build something. Add Stripe billing to our SaaS app."
> [Screen: terminal]
> ```
> /rune cook "add Stripe subscription billing with plan management"
> ```
> [Shows cook Phase 1: scout scanning → detecting @rune/saas pack]
> [Shows cook Phase 2: plan creating implementation steps]
> [Shows adversary challenging the plan: "Missing webhook signature verification — CRITICAL"]
> "See that? Before writing a single line of code, Rune's adversary skill red-teams the plan. Found a missing webhook security check."
> [Shows plan updated → user approves]
> [Shows cook Phase 3: test writing failing tests]
> [Shows cook Phase 4: fix implementing code]
> [Shows cook Phase 5: preflight + sentinel + review running in parallel]
> [Shows cook Phase 6: all green]
> "8 phases. TDD. Security scan. Code review. All orchestrated automatically."

### SCENE 5: THE MESH (2:15–2:40)

> "This isn't a list of independent tools. It's a mesh."
> [Screen: animated diagram showing skill connections]
> "When debug can't find the cause, it escalates to problem-solver. When cook hits a wall 3 times, it pivots to brainstorm. When sentinel finds a vulnerability, it blocks the commit."
> [Shows mesh diagram with glowing connections]
> "57 skills. 200+ connections. They talk to each other so you don't have to."

### CTA (2:40–3:00)

> "Rune is free and open source. MIT license."
> [Screen: GitHub repo]
> ```
> claude plugin install rune-kit/rune
> ```
> "Or for any IDE:"
> ```
> npx --yes @rune-kit/rune init
> ```
> [Screen: landing page with GitHub stars]
> "Less skills. Deeper connections. Link in description."

---

## Storyboard

| Time | Visual | Audio | Transition |
|------|--------|-------|------------|
| 0:00 | Dark terminal, red error messages repeating | Narration: frustration hook | Fade in |
| 0:08 | Rune GitHub page, hero section | Narration: intro | Cut |
| 0:20 | Terminal: plugin install command | Narration: install | Cut |
| 0:30 | Terminal: npx init for Cursor | Narration: multi-platform | Cut |
| 0:40 | Terminal: /rune onboard in real project | Narration: onboard | Cut |
| 0:50 | .rune/ directory tree appearing | Narration: context persistence | Slide in |
| 1:00 | Terminal: /rune debug command | Narration: debug scenario | Cut |
| 1:10 | Code files being read, root cause highlighted | Narration: tracing | Zoom |
| 1:20 | Fix being written, tests passing | Narration: fixed + verified | Cut |
| 1:30 | Terminal: /rune cook command | Narration: build feature | Cut |
| 1:45 | Plan appearing, adversary challenge in red | Narration: red-team | Highlight |
| 2:00 | TDD cycle: red → green → refactor | Narration: phases | Split screen |
| 2:10 | Quality gates all green | Narration: automatic orchestration | Cut |
| 2:15 | Mesh diagram (animated) | Narration: mesh explanation | Fade |
| 2:30 | Connections glowing between skills | Narration: resilience | Pulse animation |
| 2:40 | GitHub repo + install command | Narration: CTA | Cut |
| 2:50 | Landing page | Narration: tagline | Fade out |

---

## Shot List

| # | Type | Content | Duration | Notes |
|---|------|---------|----------|-------|
| 1 | Screen rec | Terminal with repeated errors | 8s | Use real project, dark theme |
| 2 | Screen rec | Rune GitHub page scroll | 5s | Show stars, description |
| 3 | Screen rec | `claude plugin install` | 8s | Real-time, no speedup |
| 4 | Screen rec | `npx @rune-kit/rune init` | 8s | Show file generation |
| 5 | Screen rec | `/rune onboard` full flow | 15s | Speed up 2x, show key moments |
| 6 | Screen rec | `/rune debug` full flow | 25s | Speed up 2x, pause on root cause |
| 7 | Screen rec | `/rune cook` full flow | 40s | Speed up 3x, pause on adversary + quality |
| 8 | Graphic | Mesh diagram animation | 20s | Create with Motion Canvas or After Effects |
| 9 | Screen rec | GitHub + install commands | 15s | Clean, centered text |
| 10 | Graphic | Landing page + tagline | 10s | End card with links |

---

## Asset Checklist

- [ ] Real project for demo (Next.js + Prisma SaaS app recommended)
- [ ] Rune plugin installed and working
- [ ] Terminal theme: dark, high contrast, large font (18-20pt)
- [ ] Screen recording tool: OBS or Loom
- [ ] Mesh diagram: create SVG or use Motion Canvas
- [ ] Background music: lo-fi or minimal electronic (royalty-free)
- [ ] Microphone for narration (or use ElevenLabs/AI voice)
- [ ] Thumbnail: terminal screenshot + "57 Skills" text overlay
- [ ] Captions/subtitles file (.srt) for accessibility

## 60-Second Twitter/X Cut

Use shots: 1 (3s) → 3 (5s) → 6 (15s) → 7 (20s) → 8 (10s) → 9 (7s)
Skip: onboard detail, mesh explanation
Hook: "Your AI assistant keeps failing? Try giving it a brain." + demo

## Distribution

- YouTube: full 3-min version with chapters
- Twitter/X: 60s cut, captions baked in, no music
- GitHub README: YouTube embed at top
- Landing page: YouTube embed in hero section
- Reddit r/ClaudeAI, r/cursor, r/webdev: link + text summary
