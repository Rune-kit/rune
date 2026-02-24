---
name: video-creator
description: Video content planning. Writes narration scripts, storyboards, shot lists, and asset checklists. Saves plan to marketing/video-plan.md.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: media
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

Write a narration script with timing marks:

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

## Note

This skill creates PLANS for video production. Actual recording and editing must be done by a human or a dedicated screen recording tool.

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

## Done When

- Platform constraints identified and applied to duration/format
- Script written with timing marks (hook, setup, demo/body, CTA)
- Storyboard created scene-by-scene with transitions
- Shot list categorized by type (screen recording, terminal, code, diagram)
- Assets needed checklist generated
- video-plan.md written to output_path via Write tool
- Video Plan Created report emitted with scene count, shot count, and asset count

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for script quality.
