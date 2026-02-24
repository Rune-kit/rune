---
name: asset-creator
description: Generate visual assets — AI image prompts, banners, OG images, icons, and HTML/CSS exportable assets.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: media
---

# asset-creator

## Purpose

Generate visual assets for projects and marketing. Creates AI image prompts, banners, OG images, icons, and HTML/CSS-based exportable assets. Bridges the gap between code and visual design.

## Triggers

- Called by marketing for launch assets
- Called by L4 UI packs for design assets

## Calls (outbound)

None — pure L3 utility.

## Called By (inbound)

- `marketing` (L2): banners, OG images, social graphics
- L4 `@rune/ui`: design system assets

## Capabilities

```
AI PROMPTS     — engineered prompts for DALL-E, Midjourney, Gemini
BANNERS        — social media banners with text overlay (HTML/CSS)
OG IMAGES      — Open Graph images for link previews
ICONS          — SVG icon generation
HTML ASSETS    — HTML/CSS assets exportable to PNG/JPG
```

## Workflow

1. Receive asset requirements — type (banner / OG image / icon), dimensions, and style context
2. Generate SVG / HTML / CSS assets or engineered AI image prompts matching the spec
3. Optimize output for the target platform (Twitter 1200x628, OG 1200x630, etc.)
4. Create multiple variants if needed (dark/light, different aspect ratios)
5. Return asset files or prompts with file paths and usage instructions

## Output Format

```
## Assets Created
- [asset type]: [file path or description]

### AI Image Prompts
- [prompt with style, mood, composition details]

### Generated Files
- assets/banner-twitter.html
- assets/og-image.html
```

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for creative quality.
