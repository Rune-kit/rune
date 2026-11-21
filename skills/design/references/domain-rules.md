# design — Domain reasoning rules

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 3 — Apply Domain Reasoning Rules

Map domain to design system parameters:

**Trading/Fintech:**
```
Style:       Data-Dense Dark
Palette:     Neutral dark (#0c1419 bg), semantic colors ONLY for profit/loss
             Profit: #00d084 (green) | Loss: #ff6b6b (red)
             Accent: #2196f3 (data highlight) — NOT purple
Typography:  JetBrains Mono 700 for ALL numeric values (prices, P&L, %)
             Inter 400 for labels, Inter 600 for headings
Effects:     Subtle grid lines, real-time pulse animations on live data
Anti-patterns:
  ❌ Gradient washes on data tables (obscures precision)
  ❌ Accent colors that conflict with profit/loss signal colors
  ❌ Decorative motion (distracts from live data)
  ❌ Dark-on-dark text for secondary labels (contrast required)
```

**SaaS Dashboard:**
```
Style:       Minimalism or Flat Design
Palette:     Professional neutrals, single brand accent (NOT purple unless brand)
             Light: #ffffff bg, #f8fafc surface | Dark: #0f172a bg, #1e293b surface
             Accent: brand-defined — default #6366f1 is acceptable here as a SaaS pattern
Typography:  Inter 400/500/600 throughout — consistent, readable, data-friendly
             Space Grotesk 700 for hero/display only
Effects:     Skeleton loaders, subtle hover states, clean data tables
Anti-patterns:
  ❌ Card-grid monotony (every section same layout)
  ❌ Animations that delay data visibility
  ❌ Missing empty/error states in data tables
```

**Landing/Marketing:**
```
Style:       Glassmorphism (current era) or Aurora/Mesh
Palette:     Brand-expressive — this is the ONE context where bold palette is correct
             High-contrast CTAs (must pass 4.5:1 contrast on all backgrounds)
Typography:  Space Grotesk 700 for hero display (48–72px)
             Inter 400/500 for body — max line-width 720px
Effects:     Animated mesh gradients, floating glass cards, scroll-triggered reveals
Anti-patterns:
  ❌ Generic hero: "big text + diagonal purple-to-blue gradient" — AI signature
  ❌ Centered layout throughout (breaks directional reading flow)
  ❌ Missing scroll animations on a static page
  ❌ CTAs that don't stand out from body copy
```

**Healthcare:**
```
Style:       Trust & Authority (clean, clinical, accessible)
Palette:     Clean blue/white/green — NO red except clinical alerts
             #f0f9ff bg, #1e40af accent, #059669 success, #dc2626 CRITICAL_ONLY
Typography:  Inter throughout — never decorative fonts
             Body minimum 16px for readability by older/impaired users
Effects:     Minimal — subtle hover, no motion by default
Anti-patterns:
  ❌ Dark mode as default (patients/elderly → light mode)
  ❌ Gamification patterns (inappropriate for medical context)
  ❌ Red for informational messages (reserved for clinical alerts)
  ❌ Dense data layouts without clear visual hierarchy
```

**E-commerce:**
```
Style:       Conversion-Optimized (Warm Minimalism)
Palette:     Warm neutrals, high-contrast CTAs
             Urgency signals: #ef4444 for "low stock", #f59e0b for "sale"
Typography:  Bold product names (Space Grotesk 600+), readable descriptions (Inter 400)
Effects:     Hover zoom on product images, add-to-cart pulse, trust badges
Anti-patterns:
  ❌ Cluttered above-fold (too many competing CTAs)
  ❌ Add to cart button that doesn't stand out
  ❌ Missing product image zoom/gallery
  ❌ Checkout flow with more than 3 steps visible at once
```

**Developer Tools:**
```
Style:       Minimalism or Neubrutalism
Palette:     Dark mode default — #0d1117 bg (GitHub-scale), #161b22 surface
             Syntax highlighting colors as accent palette
             No heavy gradients — developers recognize and distrust decorative UI
Typography:  JetBrains Mono for code/commands, Inter for prose
Effects:     Keyboard shortcuts visible, dense information layout OK
Anti-patterns:
  ❌ Decorative animations that delay tool response
  ❌ Non-monospace font for code blocks or command output
  ❌ Light mode only (developer tools default to dark)
  ❌ Visual noise around core functionality
```

**Creative/Portfolio:**
```
Style:       Editorial Grid or Glassmorphism or Brutalism (brand-specific)
Palette:     MUST be distinctive — generic palettes are disqualifying
             This is the one category where custom/unusual palettes are required
Typography:  Custom or display font as headline (NOT Inter alone)
             Font pairing must have contrast: Display + neutral body
Effects:     Curated — hover reveals, scroll-based reveals, cursor effects
Anti-patterns:
  ❌ Generic card grid with equal padding everywhere
  ❌ Inter-only typography (zero personality)
  ❌ Stock photo backgrounds
  ❌ Navigation that looks like every other portfolio
```

**AI-Native:**
```
Style:       Minimal Functional or Glassmorphism
Palette:     Purple/violet IS acceptable here (it is the AI-native signal)
             #7c3aed accent, dark neutral bg, subtle gradients
Typography:  Inter throughout — clarity over personality
Effects:     Typing indicators, streaming text, thinking states
Anti-patterns:
  ❌ Purple on non-AI product (exports the AI signal to inappropriate contexts)
  ❌ Static empty states — AI interfaces must show "thinking" states
  ❌ Missing latency UX (skeleton during generation, cancel button)
```
