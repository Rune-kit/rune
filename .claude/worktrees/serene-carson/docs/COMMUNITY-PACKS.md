# Community Extension Packs

## What Are Community Packs?

Community L4 extension packs extend Rune's core mesh with domain-specific skills. They follow the same PACK.md format as core extensions but are maintained by the community.

Community packs are **SKILL.md markdown files** — they contain instructions, not executable code. This makes them inherently safe: Claude reads them and follows the patterns, but packs cannot execute arbitrary code.

## Creating a Community Pack

### 1. Scaffold

```bash
# Use skill-forge to generate the structure
/rune pack create my-pack-name
```

Or manually create:
```
my-pack-name/
├── PACK.md       # Required — follows docs/EXTENSION-TEMPLATE.md
├── LICENSE        # Recommended — MIT preferred
└── README.md     # Optional — for GitHub display
```

### 2. Write PACK.md

Follow `docs/EXTENSION-TEMPLATE.md` exactly. Required sections:
- YAML frontmatter (name, description, layer: L4)
- Purpose
- Triggers
- Skills Included (with ### headers, workflow steps, examples)
- Connections
- Constraints
- Sharp Edges
- Done When
- Cost Profile

### 3. Validate

```bash
node scripts/validate-pack.js ./my-pack-name
```

### 4. Publish

1. Push your pack to a public Git repository
2. Submit a PR to [rune-kit/rune-community-index](https://github.com/rune-kit/rune-community-index) adding your pack to `index.json`:

```json
{
  "name": "@community/my-pack-name",
  "repo": "github:username/rune-pack-name",
  "description": "One-line description",
  "version": "0.1.0",
  "tags": ["domain", "framework"]
}
```

## Installing Community Packs

```bash
/rune pack install github:username/rune-pack-name
```

This clones the repo to `.rune/community-packs/<name>/` and registers it in `.rune/community-packs/registry.json`.

## Managing Packs

```bash
/rune pack list              # List all installed packs (core + community)
/rune pack remove <name>     # Remove a community pack
/rune pack install <git-url> # Install from Git
/rune pack create <name>     # Scaffold a new pack
```

## Security

- Community packs are validated by `integrity-check` (L3) on load
- Packs cannot modify core L1-L3 skills
- Packs are sandboxed to their `.rune/community-packs/<name>/` directory
- All pack files are markdown — no executable code

## Quality Guidelines

A good community pack:
- Solves a real domain-specific problem (not covered by core L1-L3)
- Has concrete workflow steps (not vague advice)
- Includes code examples for every skill
- Declares connections to the core mesh (which L2 skills call it, which L3 it uses)
- Has constraints that prevent common mistakes in the domain
- Lists sharp edges specific to the domain

## Pack Registry Format

`.rune/community-packs/registry.json`:
```json
{
  "version": 1,
  "packs": {
    "my-pack-name": {
      "repo": "github:username/rune-pack-name",
      "installed": "2026-02-28",
      "version": "0.1.0",
      "path": ".rune/community-packs/my-pack-name"
    }
  }
}
```
