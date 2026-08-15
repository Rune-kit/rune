# diagram — Examples

Two shipped examples demonstrating the v0.1 output contract. Each is a self-contained HTML file (inline CSS + inline SVG) that passes both gate scripts:

```bash
python skills/diagram/scripts/self_check.py skills/diagram/examples/architecture.html
python skills/diagram/scripts/verify_geometry.py skills/diagram/examples/architecture.html
```

| File | Type | Notes |
|------|------|-------|
| `architecture.html` | Architecture | 6 nodes, 1 focal accent, horizontal primary flow, dashed async connector |
| `flowchart.html` | Flowchart | start/decision/step/end shapes, happy-path coral, orthogonal branch elbows |

Both use the shipped default skin. When a project ships `.rune/design-system.md` or `.rune/conventions.md`, resolve tokens and fonts from those first (see `references/style-guide.md`).
