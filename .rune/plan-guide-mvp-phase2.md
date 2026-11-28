# Phase 2: Discovery surfaces (CLI + release notes)

## Goal
Users hear about a release once in their terminal and read real notes (not commit subjects) on GitHub, Telegram and ClawHub.

## Data Flow
```
compiler/data/whats-new.json → whatsNewNotice({version, home, isTTY, json, env}) → ≤3 highlight lines + link
                                            ↓
                                ~/.rune/whats-new.json { lastSeen }
tag push → publish.yml → node scripts/site-gen.mjs notes X.Y.Z → release-notes.md → gh release create|edit
tag push → notify-telegram.yml → node scripts/site-gen.mjs notes X.Y.Z --telegram → sendMessage
```

## Code Contracts
```js
// compiler/lib/whats-new.js
shouldShowWhatsNew({ command, args, isTTY, env, version, state, runeHomeExists }) → boolean
formatWhatsNew(data, { max = 3 }) → string[]
maybeShowWhatsNew({ command, args, version, home, isTTY, env, data, log }) → Promise<boolean>
// CLI: `rune whats-new` always prints (any stdout), `--json` prints the data
```

## Tasks
- [x] P2-T1 — notice logic + state file — File `compiler/lib/whats-new.js` — Test `compiler/__tests__/whats-new.test.js`
- [x] P2-T2 — call after successful setup/update/init/build/doctor/status/hooks/help; add `rune whats-new` — File `compiler/bin/rune.js`
- [x] P2-T3 — release.mjs prepare runs site-gen and stages generated files — File `scripts/release.mjs`
- [x] P2-T4 — publish.yml release notes + ClawHub changelog from CHANGELOG; Telegram from CHANGELOG — Files `.github/workflows/*.yml`

## Failure Scenarios
| When | Then |
|------|------|
| non-TTY, `--json`, `CI`, `RUNE_NO_WHATS_NEW=1` | no output, state untouched |
| first-ever run (no `~/.rune/`) | silent, records version |
| state file unreadable/corrupt | treat as unseen, never throw |
| HOME not writable | print once, swallow write error |
| tag has no CHANGELOG section | workflow falls back to the old git-log notes |
