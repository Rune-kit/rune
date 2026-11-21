# onboard — Per-runtime agent config and hooks

> Reference for `skills/onboard/SKILL.md` Step 4.5. Each row was checked against the runtime's own docs on 2026-11-21; re-check a runtime's docs before adding a new file type. Never invent config keys.

## Which files each runtime reads

| Runtime | Project instructions | Skills folder (compiled Rune) | Hooks — how Rune wires them | Trust / notes |
|---|---|---|---|---|
| Claude Code | `CLAUDE.md` (+ `.claude/rules/`) | plugin, or `skills/` in place | `rune hooks install --platform claude` → `.claude/settings.json` | Full PreToolUse / PostToolUse / Stop parity |
| Codex | `AGENTS.md` | `.agents/skills/` | `rune hooks install --platform codex` → `.codex/hooks.json`; model roles in `.codex/agents/*.toml` (from `rune build --platform codex`) | Codex loads a project `.codex/` folder only for a trusted project; review new hooks in `/hooks` |
| Grok Build | `AGENTS.md` (also reads `CLAUDE.md`, `.grok/rules/*.md`, `.claude/rules/`, `.cursor/rules/`) | `.grok/skills/` | `rune hooks install --platform grok` → `.grok/hooks/rune.json` | Project hooks run only after `/hooks-trust` (or `grok --trust`). Grok also reads `.claude/settings.json` — keep Rune hooks in one of the two or they fire twice. `grok inspect` lists the rules files it loaded |
| Gemini CLI | `GEMINI.md`; `context.fileName` in `.gemini/settings.json` can add `AGENTS.md` (e.g. `["AGENTS.md", "GEMINI.md"]`) | `.gemini/skills/` | `rune hooks install --platform gemini` → merges Rune entries into `hooks` in `.gemini/settings.json` (other settings kept). The Rune extension (`gemini extensions install https://github.com/rune-kit/rune`) ships its own lifecycle `hooks/hooks.json` | Gemini asks you to trust new project hooks on first run (`/hooks panel`). Prefer `context.fileName` over a duplicate file when the project already has `AGENTS.md` |
| Cursor | `AGENTS.md` and `.cursor/rules/*.mdc` | `.cursor/skills/` | `rune hooks install --platform cursor` → native `.cursor/hooks.json` (user hooks in the file are kept) | Project hooks run only in a trusted workspace. Cursor also imports `.claude/settings.json` hooks by default — keep Rune hooks in one of the two or they fire twice |
| Windsurf / Devin Desktop | `.devin/rules/` (`.windsurf/rules/` fallback) | `.devin/skills/` (`.windsurf/skills/`) | `rune hooks install --platform windsurf` → workflows + rules | Workflows fire on user command, not tool use |
| Antigravity | `AGENTS.md` (+ `CLAUDE.md` fallback) | `.agents/skills/` | `rune hooks install --platform antigravity` → rule injection | No tool-level hooks |
| GitHub Copilot | `AGENTS.md`, `.github/copilot-instructions.md` | `.github/skills/` | — | Copilot reads both; keep one canonical and point the other at it |
| OpenCode, Amp, Cline, Qoder, Qwen | `AGENTS.md` | per `rune build --platform <name>` | — | |

## Procedure (Step 4.5)

1. **Detect runtimes in use.** A runtime counts as present when its folder or file exists: `.claude/`, `.codex/`, `.grok/`, `.gemini/` or `GEMINI.md`, `.cursor/`, `.devin/` or `.windsurf/`, `.agents/`, `.github/copilot-instructions.md`. Also count the runtime you are running in now. Ask the user before adding a runtime that has no folder yet.
2. **One canonical instructions file.** Write the Step 4 content once:
   - `AGENTS.md` when any non-Claude runtime is present; `CLAUDE.md` when Claude Code is the only one.
   - When both are needed, keep the content in `AGENTS.md` and make `CLAUDE.md` a short file whose first line is `@AGENTS.md` (Claude Code imports it) plus any Claude-only notes. Grok, Codex, Cursor, Antigravity and Copilot read `AGENTS.md` directly.
   - Gemini CLI: add `AGENTS.md` to `context.fileName` in `.gemini/settings.json` rather than copying the content into `GEMINI.md`. If a hand-written `GEMINI.md` already exists, keep it and add a pointer line to `AGENTS.md`.
   - Merge rules from Step 4 apply to every file: preserve `<!-- manual -->` sections, update only auto-detected sections.
3. **Hooks.** For each detected runtime that has a Rune hooks target (claude, codex, grok, gemini, cursor, windsurf, antigravity), propose one command and run it only after the user agrees:
   `npx @rune-kit/rune hooks install --platform <runtime> --preset gentle`
   (`gentle` = advisory; `strict` blocks on a BLOCK verdict). For Claude Code + Grok in the same repo, install for one of them only (Grok reads `.claude/settings.json`). Then remind the user of the trust step for Codex (`/hooks`) and Grok (`/hooks-trust`).
4. **Compiled skills (optional).** If the user wants vendored skills instead of a plugin or extension, suggest `npx @rune-kit/rune build --platform <runtime>` per runtime; the output folders are in the table above.
5. **Report** the files written, the hooks commands run or proposed, and the trust steps still pending, in the Output Format's "Runtime setup" block.

## Do not

- Do not create a folder for a runtime the user does not use.
- Do not write keys you have not seen in that runtime's docs (e.g. no `model` field in Antigravity or Grok skill frontmatter, no `hooks` key in Grok's root `plugin.json`).
- Do not duplicate full instructions across `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` — copies drift. Point, import or configure instead.
