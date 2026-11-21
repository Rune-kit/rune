# skill-forge — Extension authoring

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Extension vs Skill vs Pack

| Concept | Purpose | Modifies Core? | Self-contained? |
|---------|---------|----------------|-----------------|
| **Skill** | Standalone workflow unit (SKILL.md) | N/A — IS core | Yes |
| **Pack** | Domain bundle of skills (PACK.md) | No — bundles existing | Yes |
| **Extension** | Augments existing skill with new capability | No — additive only | Yes — own dir with install/uninstall |

#### Extension Directory Structure

```
extensions/<extension-name>/
├── EXTENSION.md           # Manifest: what it extends, how, dependencies
├── install.sh             # Unix installer (non-destructive MCP merge)
├── install.ps1            # Windows installer
├── uninstall.sh           # Clean removal
├── uninstall.ps1          # Clean removal (Windows)
├── skills/
│   └── <skill-name>/
│       └── SKILL.md       # New skill added by extension
├── agents/                # Optional subagent definitions
│   └── <agent-name>.md
├── references/            # Domain knowledge loaded by extension skills
│   └── <topic>.md
├── scripts/               # Executable utilities
│   └── <script>.py|.sh
└── docs/
    └── SETUP.md           # Extension-specific configuration guide
```

#### EXTENSION.md Manifest

```yaml
---
name: "<extension-name>"
extends: "<target-skill-or-pack>"
description: "What capability this extension adds"
requires:
  - mcp: "<mcp-server-name>"        # Optional: MCP server dependency
  - skill: "<required-skill-name>"   # Required core skill
install_method: "non-destructive"    # MUST be non-destructive
---
```

#### Extension Rules

1. **Non-destructive install** — extension MUST NOT modify existing skill files. It adds new files alongside.
2. **Self-contained** — removing the extension directory restores the system to its pre-install state.
3. **MCP merge** — if the extension adds MCP tools, install script MUST merge into settings.json without overwriting existing entries.
4. **Fallback graceful** — if the MCP server or external dependency is unavailable, the extension skill MUST degrade gracefully (report unavailability, don't crash).
5. **Cost awareness** — if the extension calls paid APIs, the extension skill MUST warn before expensive operations and track usage.
6. **Pre-flight check** — extension skill Step 1 MUST verify dependencies are available before executing.

#### When to Build an Extension (vs a Skill or Pack)

- Build an **extension** when: the capability requires an external API/MCP, is optional, and augments an existing skill
- Build a **skill** when: the capability is self-contained and fits a layer in the mesh
- Build a **pack** when: you're bundling multiple related skills for a domain
