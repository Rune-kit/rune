# design — Platform-specific overrides

> Reference for `skills/design/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 4 — Platform-Specific Overrides

Apply platform conventions on top of domain rules:

**iOS (SwiftUI / iOS 26+):**
```
Visual language: Liquid Glass — translucent surfaces with backdrop blur
  background: UIBlurEffect or .regularMaterial
  border: subtle 1px rgba(white, 0.15) — NOT solid
  roundness: aggressive corner radius (16–24px on cards, full on buttons)
Icons: SF Symbols ONLY — not Heroicons, not Lucide
Typography: SF Pro family — Dynamic Type scaling is mandatory
Safe areas: Content must respect safeAreaInsets on all edges
Anti-patterns:
  ❌ Solid-background cards (deprecated in iOS 26 Liquid Glass era)
  ❌ Custom icon fonts (SF Symbols is the platform contract)
  ❌ Fixed font sizes (Dynamic Type must be supported)
```

**Android (Jetpack Compose / Material 3 Expressive):**
```
Color: MaterialTheme.colorScheme — dynamic color derived from wallpaper
  NEVER hardcode hex colors in Compose — use semantic tokens
Shape: Extreme corner expressiveness — use shape variation as affordance signal
  Small interactive: RoundedCornerShape(4dp)
  Cards/surfaces: RoundedCornerShape(16dp)
  FABs: CircleShape
Motion: Spring physics — tween() is almost never the right choice
  spring(dampingRatio = Spring.DampingRatioMediumBouncy)
Anti-patterns:
  ❌ Hardcoded hex colors (breaks dynamic color contract)
  ❌ Linear easing (Material 3 Expressive uses spring physics)
  ❌ Small corner radii (shape expressiveness is a key M3 Expressive principle)
```

**Web:**
- Apply domain rules from Step 3
- Default: dark mode support required (`prefers-color-scheme: dark`)
- Responsive: must design for 375px, 768px, 1024px, 1440px breakpoints
- Accessibility: WCAG 2.2 AA minimum
