---
name: video-creator
description: "Video content planning. Writes narration scripts, storyboards, shot lists, and asset checklists. Saves plan to marketing/video-plan.md."
metadata:
  author: runedev
  version: "0.3.0"
  layer: L3
  model: sonnet
  group: media
  tools: "Read, Write, Edit, Glob, Grep"
---

# video-creator

## Purpose

Video content planning for product demos and marketing. Writes narration scripts with timing marks, creates scene-by-scene storyboards, defines shot lists, and lists required assets. Saves the complete production plan to a file. This skill creates PLANS for video production — not actual video files.

## Called By (inbound)

- `marketing` (L2): demo/explainer video scripts
- `launch` (L1): product demo videos

## Calls (outbound)

None — pure L3 utility.

## Executable Instructions

### Step 1: Receive Brief

Accept input from calling skill:
- `topic` — what the video is about (e.g. "Rune plugin demo", "Feature X walkthrough")
- `audience` — who will watch (e.g. "developers", "non-technical founders", "existing users")
- `duration` — target length in seconds (e.g. 60, 120, 300)
- `platform` — where it will be published: `youtube` | `twitter` | `tiktok` | `loom` | `internal`
- `output_path` — where to save the plan (default: `marketing/video-plan.md`)

Derive constraints from platform:
- YouTube: no strict length limit, chapters recommended for > 3min
- Twitter/X: max 140 seconds, hook in first 3 seconds
- TikTok: max 60 seconds, fast-paced cuts, captions required
- Loom: async-friendly, screen recording focus, no music needed

### Step 2: Script

Write a narration script with timing marks. **Before writing a single line, apply the
Narration Craft principles below** — a script the viewer HEARS lives or dies on the
opening and the flow, not the shot list.

Structure:
- **Hook** (0–5s): opening line that grabs attention — state the problem or the payoff
- **Setup** (5–15s): context — who this is for and what they will learn
- **Demo/Body** (15s–[duration-15s]): main content broken into scenes
- **CTA** (last 10s): call to action — what to do next (star repo, sign up, share)

Format each section:
```
[00:00] HOOK
Narration: "..."
On screen: [what viewer sees]

[00:05] SETUP
Narration: "..."
On screen: [what viewer sees]
```

### Step 3: Storyboard

Create a scene-by-scene breakdown:

For each scene:
- Scene number and name
- Duration in seconds
- Visual description (what appears on screen)
- Narration text (from Step 2)
- Transition type: cut | fade | zoom | slide

Example:
```
Scene 3: Live demo — install command
Duration: 12s
Visual: Terminal window, typed command "npm install -g @rune/cli", output scrolling
Narration: "Install in seconds with one command."
Transition: cut
```

### Step 4: Shot List

Define exactly what needs to be recorded or shown:

Categorize by type:
- **Screen recording**: list each screen state to capture (URL, app state, what to do)
- **Code snippet**: list each code block to display (file path + line range, or inline)
- **Diagram/slide**: list each static visual needed (title, key points)
- **Terminal**: list each command sequence to record

Format:
```
Shot 1 — Screen recording
  URL: https://myapp.com/dashboard
  Action: Click "New Project" → fill form → click Create
  Duration: ~8s

Shot 2 — Terminal
  Command: npm install -g @rune/cli && rune init my-project
  Expected output: [describe what should appear]
  Duration: ~10s
```

### Step 5: Assets Needed

List every asset required before recording can begin:

- Screenshots (which pages/states)
- Code snippets (which files, which sections)
- Diagrams (topic, style: flowchart | architecture | comparison table)
- Slide backgrounds or title cards
- Thumbnail (dimensions based on platform: YouTube 1280x720, Twitter 1200x628)

### Step 6: Report

Use `Write` to save the complete video plan to `marketing/video-plan.md` (or the specified `output_path`):

```markdown
# Video Plan: [topic]

- **Platform**: [platform]
- **Target Duration**: [duration]s
- **Audience**: [audience]
- **Created**: [date]

## Script
[full timestamped script from Step 2]

## Storyboard
[scene-by-scene breakdown from Step 3]

## Shot List
[all shots from Step 4]

## Assets Needed
[checklist from Step 5]

## Platform Notes
[constraints and tips for the target platform]
```

Then output a summary to the calling skill:

```
## Video Plan Created

- File: [output_path]
- Scenes: [count]
- Shots: [count]
- Estimated recording time: [n] minutes
- Assets to prepare: [count] items

### Next Steps
1. Prepare assets listed in the plan
2. Record shots in order from the shot list
3. Edit using the storyboard as reference
```

## Narration Craft (decides whether a script hooks or bores)

A demo script is HEARD by a person, not read off a slide. These principles separate an
engaging script from generic voiceover — apply them in Step 2, before writing any line.

**The 9 principles:**
1. **Pain-first opening.** Open on the viewer's biggest pain or a stat already in flight ("Nếu bạn hay phải…", "This repo has 9k stars and…"). NEVER a flat catalogue opener ("Today we'll look at…", "This is a tool that…") — it names no problem and gives zero reason not to scroll.
2. **Contrast structures.** "not just X but Y", "not X, it's Y", "like X but with Y". Contrast pulls attention.
3. **2nd-person address.** "you'll see right away", "if you build on an M-series Mac…". Bring the viewer in.
4. **Demonstrative immediacy.** "right here", "this", "on the timeline now". Concrete and present.
5. **Specific real names, keep the jargon.** Name actual files, commands, competitors ("Final Cut", "Cursor", "ffmpeg"). Generic terms ("an AI tool", "the framework") are banned. Don't force-translate jargon into awkward words.
6. **Quantified social proof — ONCE.** "over 9k stars". Never dump stars + forks + issues back-to-back as separate fragments.
7. **Short clauses, comma-flowed.** "You can trim, replace, or regenerate it." One breath, not bullet fragments.
8. **Caveat-as-feature.** State one honest limit or a "who should NOT use this". This is the most trust-building line in the video — a retention feature, not filler.
9. **Use-case landing.** Close on a SPECIFIC viewer scenario, not "go check it out".

**Named + numbered "weapons".** Give each differentiator a title and a number ("Weapon 01/02"). Mine the 2-3 NON-OBVIOUS specifics (a regex, a guard, an algorithm, a fallback) — one precise surprising mechanism beats a generic capability list.

**Connectors between scenes.** Each scene after the first opens with a linguistic connector referring back ("The core of it is…", "Specifically…", "But note…") so the whole video plays as ONE monologue, not N telegraphic captions read in a row. Read the full script aloud in sequence — if it sounds like disconnected soundbites, rewrite.

**Auto-fail patterns — reject the script if any appear:**
- ❌ Hook/Problem/Solution/CTA fill-in-the-blank treated as isolated fragments
- ❌ Sidebar stats (stars/forks/issues) as separate one-line scenes
- ❌ Every sentence restarts as a stand-alone bullet ("X runs one pipeline. Y writes. Z narrates.")
- ❌ Generic capability claims ("full-featured", "very powerful", "popular in the community")
- ❌ Describing the README/repo instead of the product
- ❌ Closing with "go check it out" / "thanks for watching"

## Voiceover: TTS-Safe Narration (when narration is machine-spoken)

When narration will be synthesized by a TTS engine (AI voiceover, not a human reading),
the spoken `narration` and the on-screen text are SEPARATE channels — one is heard, one
is read. Optimize each independently; never feed a raw slug, number, or symbol into TTS
and hope the voice guesses right. (The Vietnamese examples below illustrate the pattern;
apply the same phonetic + numbers-as-words substitution for whatever language the target
TTS engine speaks.)

**Numbers → spoken words** (many neural TTS engines can misread bare digits — VN examples):

| Form | TTS misreads | Write as |
|---|---|---|
| Version decimal | `GPT 5.5` → "năm rưỡi" | `GPT năm chấm năm` |
| Stat decimal | `82.7%` | `tám mươi hai phẩy bảy phần trăm` |
| Spec | `200MP` | `hai trăm megapixel` |
| Price | `$5` / `21 triệu` | `năm đô` / `hai mươi mốt triệu đồng` |
| Multiplier / percent | `2x` / `30%` | `gấp đôi` / `ba mươi phần trăm` |

**English/brand names → phonetic in narration, exact spelling on screen:**

| Term | narration (heard) | display (read) |
|---|---|---|
| README | `ruýt my` | `README` |
| ffmpeg | `ép ép em peg` | `ffmpeg` |
| GitHub / repo | `git hâb` / `rề pô` | `GitHub` / `repo` |
| API / GPT | `ây pi ai` / `gí pi tí` | `API` / `GPT` |

**Strip from spoken narration:** emoji, URLs (say "github chấm com gạch…"), symbols (`→ & % $ # / @`), slash-commands (say "the plugin install command"), file extensions mid-sentence (say "the YAML file"), camelCase identifiers, ellipsis `…` and em-dash `—` (TTS misreads them — split into two short sentences). End every sentence with `.` or `?` for a natural pause.

**Keep the jargon, natural spoken register.** Write the way a knowledgeable friend SAYS it — but keep the standard technical term ("commit", "endpoint", "prompt" stay in their usual form; a hard translation sounds wrong and loses meaning). Only translate when the local word is the one people actually use.

**Production notes for a spoken video (if it will actually be produced, not just planned):**
- **One voice, one provider across all scenes** — a voice/provider change mid-video is jarring.
- **Measure TTS duration FIRST**, then size each scene's visuals to the real audio length — estimating duration then rendering causes A/V drift.
- **Karaoke captions are the #1 pro-signal** for short-form (TikTok/Reels/Shorts): a bottom-center caption filling word-by-word in sync with the voice, keyword-accented. Muted-autoplay comprehension plus the single strongest "professional" cue — reserve a bottom caption band for it.

## Note

This skill creates PLANS for video production. Actual recording and editing must be done by a human or a dedicated screen recording tool.

## Output Format

Video Plan saved to `marketing/video-plan.md` with script, storyboard, shot list, assets checklist, and platform notes. Summary report with scene/shot counts and estimated recording time. See Step 6 Report above for full template.

## Constraints

1. MUST confirm video parameters (duration, resolution, format) before generating
2. MUST NOT exceed reasonable file sizes without user confirmation
3. MUST save to project assets directory

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Platform constraints not applied (e.g., Twitter max 140s exceeded) | HIGH | Step 1: derive constraints from platform immediately — they constrain everything downstream |
| Missing CTA section in script | MEDIUM | CTA (last 10s) is required in every script — no exceptions regardless of duration |
| Not saving to file (only verbal output) | HIGH | Constraint 3 + Step 6: Write to output_path is mandatory — verbal only = no persistence |
| Promising an actual deliverable video file | MEDIUM | Note explicitly: this skill creates a PLAN — actual recording is done by a human |
| Flat catalogue opener ("Today we'll look at…") instead of a pain-first hook | HIGH | Narration Craft #1: open on the viewer's biggest pain — an opener that names no problem loses the scroll in 2 seconds |
| Raw slugs/numbers/symbols left in narration for TTS ("README", "82.7%", "5.5") | HIGH | Voiceover section: rewrite spoken narration phonetically + numbers-as-words; keep exact spelling only on the display channel |
| Script reads as N disconnected soundbites | MEDIUM | Narration Craft connectors: each scene after the first opens referring back — read the whole script aloud before declaring done |

## Done When

- Platform constraints identified and applied to duration/format
- Narration Craft applied — pain-first opening, cross-scene connectors, ≥1 caveat-as-feature, no auto-fail patterns
- If narration is TTS-spoken: numbers-as-words + phonetic brand names in the spoken channel, exact spelling on display
- Script written with timing marks (hook, setup, demo/body, CTA)
- Storyboard created scene-by-scene with transitions
- Shot list categorized by type (screen recording, terminal, code, diagram)
- Assets needed checklist generated
- video-plan.md written to output_path via Write tool
- Video Plan Created report emitted with scene count, shot count, and asset count

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for script quality.
