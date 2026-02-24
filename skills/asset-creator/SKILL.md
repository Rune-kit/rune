---
name: asset-creator
description: Creates code-based visual assets — SVG icons, OG image HTML templates, social banners, and icon sets. Outputs files with usage instructions.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: media
---

# asset-creator

## Purpose

Creates code-based visual assets (SVG, CSS, HTML) for projects and marketing. Handles logos, OG images, social cards, and icon sets. Outputs actual files with light/dark variants and usage instructions. This skill creates CODE-based assets — not raster images.

## Called By (inbound)

- `marketing` (L2): banners, OG images, social graphics
- L4 `@rune/ui`: design system assets

## Calls (outbound)

None — pure L3 utility.

## Executable Instructions

### Step 1: Receive Brief

Accept input from calling skill:
- `asset_type` — one of: `logo` | `og_image` | `social_card` | `icon` | `icon_set` | `banner`
- `dimensions` — width x height in pixels (e.g. `1200x630` for OG images)
- `style` — description of visual style (e.g. "minimal dark", "comic bold", "glassmorphism")
- `content` — text, brand name, tagline, or icon names to include
- `output_dir` — where to save files (default: `assets/`)

### Step 2: Design

Before writing code, determine design parameters:

1. Check if the project has `.rune/conventions.md` — use `Read` to load color palette and typography
2. If no conventions file, apply defaults based on `style`:
   - "dark" → `#0c1419` bg, `#ffffff` text, `#2196f3` accent
   - "light" → `#faf8f3` bg, `#1a1a1a` text, `#1d4ed8` accent
   - "comic" → `#fffef9` bg, `#1a1a1a` text, `2px solid #2a2a2a` border, `4px 4px 0 #2a2a2a` shadow
   - "glassmorphism" → `rgba(255,255,255,0.05)` bg, `backdrop-filter: blur(12px)`, `rgba(255,255,255,0.1)` border

3. Select typography:
   - Display/headlines: Space Grotesk 700
   - Body: Inter 400
   - Monospace/prices: JetBrains Mono 700

4. Apply standard dimensions by asset type if not specified:
   - OG image: 1200x630px
   - Twitter card: 1200x628px
   - Instagram square: 1080x1080px
   - Icon: 24x24px (or 512x512px for app icon)

### Step 3: Create

Use `Write` to generate the asset files:

**For SVG icons and logos:**
- Write inline SVG with proper `viewBox` attribute
- Use `xmlns="http://www.w3.org/2000/svg"`
- Include `role="img"` and `aria-label` for accessibility
- Optimize paths — no unnecessary groups or transforms
- File: `assets/[name].svg`

**For OG images and social cards:**
- Create an HTML file with embedded CSS
- Use absolute pixel values (no relative units) for pixel-perfect output
- Include Google Fonts import for Space Grotesk and Inter
- File: `assets/[name]-og.html`

**For icon sets:**
- Create a single SVG sprite file with `<symbol>` elements
- Each icon as a named `<symbol id="icon-[name]">` with `viewBox`
- Include a usage example comment at the top
- File: `assets/icons/sprite.svg`

**For HTML banners:**
- Self-contained HTML with all styles inline (no external deps)
- File: `assets/banner-[platform].html`

### Step 4: Variants

If `style` contains "dark" or the asset type is OG/banner, also create a light mode variant:
- Suffix dark variant with `-dark` (e.g. `og-dark.html`)
- Suffix light variant with `-light` (e.g. `og-light.html`)

For icon sets, create both a filled and outline variant if applicable.

### Step 5: Report

Output the following:

```
## Assets Created

### Generated Files
- [asset_type]: [file_path] ([dimensions])
- [asset_type] (dark): [file_path]
- [asset_type] (light): [file_path]

### Usage Instructions
- OG image: Add <meta property="og:image" content="[url]/[filename]"> to <head>
- SVG icon: <img src="assets/[name].svg" alt="[description]">
- Icon sprite: <svg><use href="assets/icons/sprite.svg#icon-[name]"></use></svg>
- Banner: Open [file] in browser, screenshot at [width]x[height]

### Design Tokens Used
- Background: [color]
- Text: [color]
- Accent: [color]
- Font: [font-family]
```

## Note

This skill creates CODE-based assets (SVG/CSS/HTML). It does not generate raster images (PNG/JPG) directly — those require screenshotting the generated HTML files using browser-pilot.

## Constraints

1. MUST confirm output format and dimensions before generating
2. MUST NOT generate copyrighted or trademarked content
3. MUST save to project assets directory — not random locations

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating copyrighted or trademarked content (logos, characters) | CRITICAL | Constraint 2: only generate original assets — no brand marks, characters, or protected symbols |
| Saving to random location instead of assets/ | MEDIUM | Constraint 3: output_dir defaults to assets/ — always save there |
| Missing light/dark variants for OG/banner assets | MEDIUM | Step 4: dark mode variant required for any OG/banner asset |
| Generating raster images (PNG/JPG) directly | MEDIUM | This skill creates SVG/HTML CODE only — raster requires browser-pilot screenshot of generated HTML |

## Done When

- Asset type, dimensions, and style confirmed from input
- Design tokens from .rune/conventions.md loaded (or defaults applied)
- Asset files written to assets/ directory in correct format (SVG/HTML)
- Light/dark variants created if applicable (OG/banner)
- Assets Created report emitted with file paths and usage instructions

## Cost Profile

~500-1500 tokens input, ~500-1000 tokens output. Sonnet for creative quality.
