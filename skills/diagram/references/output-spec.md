# Import output spec — format × size × detail × audience

Four dials decide what an imported diagram becomes. Set them **before** redrawing — they change the deliverable, layout, type ramp, node count, and wording, so retrofitting them afterwards means redrawing.

| Dial | Question it answers | Default |
|---|---|---|
| **Format** | Where does this file land? | `html` |
| **Size** | How big is the canvas, and how far away is the reader? | `doc-inline` |
| **Detail level** | Reproduce every element, or compress it? | `balanced` |
| **Audience** | How technical should the wording be? | `mixed` |

Infer choices that are clear from the request (for example, "for my deck" implies a slide preset). Ask one concise question for anything material that remains ambiguous. If the user does not care, use the defaults above and say which ones you used.

## 1. Format

v0.2 ships one format: `html` — a self-contained `.html` file with header, diagram, and footer. `svg` and `png` are out of scope (no export pipeline yet); if a user needs raster, route to `browser-pilot` for a screenshot. The HTML is the source of truth and the only artifact the gate scripts are written against.

| Destination | Format | Size preset |
|---|---|---|
| Blog post, README, docs site | `html` | `doc-inline` |
| Keynote / PowerPoint / Google Slides | `html` (screenshot via `browser-pilot`) | `slide-16x9` |
| X / LinkedIn / OG link card | `html` (screenshot via `browser-pilot`) | `social-og` |

## 2. Size

The preset sets the SVG `viewBox`. Every value below is divisible by 4, so the grid rule still holds.

| Preset | viewBox | Aspect | Type ramp | Use |
|---|---|---|---|---|
| `doc-inline` (default) | `0 0 960 600` | 8:5 | standard | Body-width diagram in a post or README |
| `slide-16x9` | `0 0 1280 720` | 16:9 | presentation | Deck slide, projected |
| `social-og` | `0 0 1200 632` | ~1.9:1 | presentation | Link preview card |

### Type ramp per size class

Node names shrink relative to the canvas as it grows — resist that. Scale the ramp with the preset so a projected slide stays readable from the back row.

| Role | standard | presentation |
|---|---|---|
| Title | 28 | 40 |
| Node name | 12 | 16 |
| Sublabel | 9 | 12 |
| Arrow label | 8 | 12 |
| Eyebrow / tag | 8 | 8 |
| Node box min height | 48 | 64 |
| Min gap between nodes | 24 | 40 |

Presentation ramp implies fewer nodes — 16px names in 64px boxes eat the canvas. If a `slide-16x9` layout won't fit, that's the size dial telling you the detail dial is set too high; drop a level rather than shrinking the type.

### Safe areas

- **All presets:** 40px outer margin; legend strip is the bottom 60px and nothing else lives there.
- **`social-og`:** keep the outer 64px clear on every side — link-card crops are unpredictable across platforms.
- **`slide-*`:** keep the bottom 80px clear if the deck template has a footer bar; ask if unsure.

## 3. Detail level

How much of the source survives. This is a *count* dial — it governs how many elements make it through, not how they're worded (that's §4).

| Level | Nodes | Edges | Sublabels | What survives |
|---|---|---|---|---|
| `faithful` (详细) | ≤24, zoned | ≤32 | every port, protocol, version | Every distinct component in the source. Only exact duplicates merge. |
| `balanced` (default) | ≤12 | ≤16 | technical sublabel on ≤4 nodes | Components that carry the story; leaf clusters collapse to one node each. |
| `simplified` (简略) | ≤7 | ≤9 | none | Capabilities and their sequence. Infrastructure disappears. |

`balanced` and `simplified` sit inside the standard complexity budget (max 9 nodes / 12 arrows). **`faithful` deliberately exceeds it** — that's the trade, and it comes with conditions:

1. **Zoning is mandatory.** Above 9 nodes, every node belongs to a labeled zone (2–4 zones, hairline-bordered, mono uppercase zone label at top-left). An unzoned 20-node diagram is a wiring diagram, not a schematic.
2. **Connector rules don't relax.** The `connectors.md` rules still apply at 24 nodes. If you can't route it without overlaps, you're over the real ceiling — split.
3. **Above 24 nodes, split.** Produce an overview (zones as nodes, `balanced` grammar) plus one detail diagram per zone. Name them `<base>-overview.html`, `<base>-<zone>.html`. Never ship a 40-node single canvas.
4. **Accent stays at 2.** More nodes never buys more focal elements.

### Degrade ladder

When the source has more than the level allows, cut in this order and stop as soon as you're under budget. Never cut ad hoc.

1. **Decorative cells** — sticky notes, free-floating text, title blocks, watermarks, the source's own legend.
2. **Exact duplicates** — N identical workers/replicas/shards become one node labeled `Worker ×N`.
3. **Leaf clusters** — a container whose children are all leaves collapses to the container. The extractor lists these under `containers`.
4. **Degree-1 sinks that don't change the story** — a monitoring hook, a log bucket, an archive tier.
5. **Cross-cutting infrastructure** — logging, metrics, secrets, CI. At `simplified` these go without asking; at `balanced` keep at most one, and only if the diagram is about it.
6. **Still over?** Split into overview + detail. Splitting beats shrinking.

Anything cut in steps 2–6 goes in the fidelity ledger (§5). Step 1 doesn't need reporting.

## 4. Audience level

Independent of the detail dial: the same 12 nodes get named differently for a platform team than for a steering committee. Detail sets *how many*; audience sets *what they're called*.

| Audience | Node names | Sublabels | Edge labels | Never |
|---|---|---|---|---|
| `engineer` | exact service / component names | protocol, port, version, image tag | `POST /v2/orders`, `SQL`, `gRPC` | Vague verbs like "connects to" |
| `mixed` (default) | component names, expanded acronyms | technology only where it changes a decision | plain verbs — `verifies`, `writes`, `notifies` | Ports, versions, internal codenames |
| `executive` | capabilities and outcomes | none | business verbs — `approves`, `pays out` | Vendor names, infrastructure, protocols |

Worked example — the same node through all three:

| Audience | Node name | Sublabel |
|---|---|---|
| `engineer` | `Auth Service` | `JWT · RS256 · :8443` |
| `mixed` | `Auth Service` | `token check` |
| `executive` | `Sign-in` | — |

Two rules that hold at every audience level:

- **Never invent detail to fill a slot.** If the source says `svc-04`, `executive` output says what it does only if you can tell from context — otherwise ask, don't guess a business name.
- **Keep the source's vocabulary for proper nouns.** Renaming `Kafka` to `Message Bus` is fine at `executive`; renaming it to `Event Grid` (a different product) is a factual error.

### Non-Latin labels

When labels contain Japanese, Chinese, or Korean text, extend the family on those `<text>` elements — don't swap the whole skin:

```svg
<text font-family="'Geist', 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif">認証サービス</text>
```

For mono sublabels use `'Geist Mono', 'Noto Sans Mono CJK JP', monospace`. CJK glyphs render ~10% wider than Latin at the same size — budget box width accordingly, and prefer 12px names over 8px sublabels for CJK, which goes muddy below 10px.

## 5. Fidelity ledger

Any time output is smaller than input — every `balanced` and `simplified` run, and most `faithful` ones — report what you cut, in chat, after the file path. Short and specific:

```
Detail: balanced · 18 source nodes → 9 drawn
Merged:  worker-01..06 → "Ingest Worker ×6"
Collapsed: "Observability" group (Grafana, Loki, Tempo) → one node
Dropped: 2 sticky notes, CI pipeline (cross-cutting)
Kept in full: the request path (Client → Gateway → Orders → Postgres)
```

The reader of the diagram can't see what's missing. The person who asked for it needs to.

## 6. Checklist

Run alongside the two gate scripts.

- [ ] All four dials set — explicitly requested, inferred from the destination, or defaulted and stated?
- [ ] `viewBox` matches the size preset exactly, values divisible by 4?
- [ ] Type ramp matches the size class — not the standard ramp on a slide?
- [ ] 40px outer margin honoured (64px for `social-og`)?
- [ ] Node count inside the detail level's ceiling?
- [ ] `faithful` above 9 nodes → zoned, and split above 24?
- [ ] Node names, sublabels, and edge labels all at the same audience level?
- [ ] CJK labels given a font fallback?
- [ ] Fidelity ledger reported for anything cut?
- [ ] Diagram `<svg>` has `role="img"`, resolving `aria-labelledby`, a non-empty first-child `<title>`, a non-empty `<desc>`, and per-diagram/variant prefixed IDs?
- [ ] `self_check.py` and `verify_geometry.py` both exit 0?
