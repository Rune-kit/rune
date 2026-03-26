---
name: "@rune/ace"
description: Anphabe Content Engine — Standalone content creation workflow for blog posts, social media, videos, emails, and scripts. No coding required. Research → Outline → Draft → Optimize → Publish.
metadata:
  author: runedev
  version: "1.0.0"
  layer: L4
  price: "free"
  target: Content creators, marketers, social media managers, video creators
  format: split
---

# ACE — Anphabe Content Engine

## Purpose

ACE (Anphabe Content Engine) is a **standalone content creation system** built on the Rune skill mesh architecture. Unlike other Rune workflows that assume you're building software, ACE creates content WITHOUT touching code. It orchestrates research, writing, optimization, and publishing workflows for blog posts, social media, video scripts, emails, and more.

ACE activates when you invoke `/rune content-cook` or work in `content/` directories (not `src/`). It's completely independent from coding workflows but can leverage existing Rune skills like `research`, `trend-scout`, `asset-creator`, and `video-creator`.

### Why ACE Exists

Content creation has fundamentally different requirements than software development:

| Software Development | Content Creation |
|---------------------|------------------|
| Code structure, tests, builds | Research, narrative, engagement |
| Dependencies, APIs, databases | Audience, platform algorithms, SEO |
| Compilation errors | Writer's block, quality subjectivity |
| Deployment pipelines | Publishing platforms, distribution channels |
| Bug tracking | Analytics, engagement metrics |

ACE provides a **purpose-built workflow** for content creators while maintaining Rune's proven orchestration patterns.

## Triggers

- Auto-trigger: when `content/` directory exists (and NO `src/` or `code/` directory)
- Auto-trigger: when files match `content/drafts/*.md`, `content/outlines/*.md`, or `content/published/*.md`
- `/rune content-cook [task]` — manual invocation
- Called by user directly — no L1/L2 orchestrators involved (this IS the orchestrator)

## Skills Included

| Skill | Model | Layer | Description |
|-------|-------|-------|-------------|
| [content-cook](skills/content-cook.md) | sonnet | L1 | Main orchestrator for all content workflows |
| [content-research](skills/content-research.md) | haiku | L3 | Gather data, statistics, competitor analysis |
| [content-outline](skills/content-outline.md) | sonnet | L3 | Create structured outlines before drafting |
| [content-draft](skills/content-draft.md) | sonnet | L3 | Write first drafts following approved outlines |
| [content-optimize](skills/content-optimize.md) | sonnet | L3 | Improve clarity, engagement, SEO |
| [content-publish](skills/content-publish.md) | haiku | L3 | Format for platforms, generate checklists |
| [visual-assets](skills/visual-assets.md) | sonnet | L3 | Generate images, infographics, social cards |
| [content-scoring](skills/../content-scoring.md) | sonnet | L4 | Predict virality, suggest improvements |

## Workflow Chains (Predefined)

```
/rune content-cook blog       → Full blog post pipeline
/rune content-cook social     → Social media content (multi-platform)
/rune content-cook video      → Video script + production plan
/rune content-cook email      → Email sequence/newsletter
/rune content-cook seo        → SEO optimization of existing content
/rune content-cook repurpose  → Turn 1 piece into 10+ formats
/rune content-cook script     → Speech, presentation, webinar script
```

### Workflow Chain Details

#### Blog Post Pipeline (`blog`)

```
Phase 1: RESEARCH (content-research)
  → Keyword research (volumes, difficulty)
  → Competitor analysis (top 10 ranking articles)
  → Statistics & expert quotes collection
  → Audience questions (Reddit, Quora, PAA)
  Output: content/research/[topic]-*.{json,md}

Phase 2: OUTLINE (content-outline)
  → H2/H3 structure based on research
  → Word count estimates per section
  → Data/source mapping to sections
  → User approval gate
  Output: content/outlines/[topic]-outline.md

Phase 3: DRAFT (content-draft)
  → Write 1500-3000 words following outline
  → Include all cited statistics
  → Add examples and case studies
  Output: content/drafts/[topic]-v1.md

Phase 4: OPTIMIZE (content-optimize)
  → Clarity improvements (Flesch score > 60)
  → Engagement boosts (stories, analogies)
  → SEO optimization (meta tags, headings, density)
  → CTA placement
  Output: content/drafts/[topic]-v2-optimized.md

Phase 5: VISUAL ASSETS (visual-assets)
  → Featured image (1200×630 OG size)
  → Social media cards (Twitter, LinkedIn)
  → Infographics/diagrams (if applicable)
  Output: assets/[topic]/*.{png,svg}

Phase 6: PUBLISH (content-publish)
  → Format as Markdown with frontmatter
  → Generate publishing checklist
  → Platform-specific formatting
  Output: content/published/[YYYY-MM-DD]-[topic].md

Total Time: ~15-20 minutes
Token Cost: ~8,000-12,000 tokens (end-to-end)
```

#### Social Media Pipeline (`social`)

```
Phase 1: RESEARCH (lite)
  → Trending topics in niche
  → Viral post patterns (top performers)
  → Platform-specific best practices
  Output: content/research/social-[platform]-*.md

Phase 2: DRAFT (skip outline for short-form)
  → Platform-appropriate length:
    - Twitter/X: 280 chars × 5-10 tweets
    - LinkedIn: 150-300 words
    - Facebook: 100-250 words
    - Instagram caption: 150-200 words
  → Hook-first writing
  → CTA included
  Output: content/drafts/social-[platform]-v1.md

Phase 3: OPTIMIZE
  → Emotional triggers (curiosity, urgency, FOMO)
  → Hashtag strategy (3-5 for IG, 2-3 for Twitter)
  → Visual recommendations
  Output: content/drafts/social-[platform]-v2.md

Phase 4: VISUAL ASSETS
  → Image suggestions (Canva templates)
  → Carousel slides (if applicable)
  → Meme/GIF recommendations
  Output: assets/social/[platform]-*.png

Phase 5: PUBLISH
  → Platform-specific formatting
  → Scheduling recommendations
  → Engagement tracking setup
  Output: content/published/social-[platform]-ready.md

Total Time: ~8-12 minutes
Token Cost: ~4,000-6,000 tokens
```

#### Video Script Pipeline (`video`)

```
Phase 1: RESEARCH
  → Successful video patterns in niche
  → Thumbnail A/B test insights
  → Title optimization (CTR data)
  Output: content/research/video-*.md

Phase 2: OUTLINE
  → Hook (0:00-0:15)
  → Intro (0:15-0:45)
  → Main content (0:45-END-0:30)
  → Outro/CTA (last 30 seconds)
  → Shot list notes
  Output: content/outlines/video-script-outline.md

Phase 3: DRAFT
  → Word-for-word narration
  → Timing marks (every 15-30s)
  → B-roll suggestions
  → On-screen text cues
  Output: content/drafts/video-script-v1.md

Phase 4: OPTIMIZE
  → Pacing adjustments (150 wpm target)
  → Pattern interrupts every 30-60s
  → Retention hooks throughout
  → Chapter markers (for YouTube)
  Output: content/drafts/video-script-v2.md

Phase 5: VISUAL ASSETS
  → Thumbnail design (1280×720)
  → Storyboard frames
  → End card template
  Output: assets/video/thumbnail.png, storyboard.svg

Phase 6: PUBLISH
  → Script formatted for teleprompter
  → Shot list separated
  → Equipment checklist
  → Editing notes (transitions, effects)
  Output: content/published/video-script-final.md

Total Time: ~20-30 minutes
Token Cost: ~10,000-15,000 tokens
```

## Connections

```
Calls → research (L3): external web search, data gathering
Calls → trend-scout (L3): market analysis, trending topics
Calls → asset-creator (L3): visual asset generation
Calls → video-creator (L3): video script planning (legacy support)
Calls → marketing (L2): social media distribution strategy
Called By ← user: `/rune content-cook` direct invocation
```

### Integration with Existing Rune Skills

ACE leverages existing Rune utilities without modification:

| Existing Skill | ACE Usage |
|---------------|-----------|
| `research` | Web search for statistics, expert quotes, competitor data |
| `trend-scout` | Market trends, viral patterns, platform algorithm changes |
| `asset-creator` | OG images, social cards, thumbnails, infographics |
| `video-creator` | Video script planning (ACE extends to full production) |
| `marketing` | Distribution strategy, launch planning |
| `hallucination-guard` | Verify statistics and quotes aren't fabricated |
| `verification` | Check SEO implementation, metadata completeness |

## Tech Stack Support

| Content Type | Platforms | Tools |
|--------------|-----------|-------|
| Blog Posts | WordPress, Medium, Substack, Ghost | Next.js, Gatsby, Hugo |
| Social Media | Twitter/X, LinkedIn, Facebook, Instagram, TikTok | Buffer, Hootsuite, Later |
| Video Scripts | YouTube, TikTok, Instagram Reels, Vimeo | Descript, CapCut, Premiere Pro |
| Email | ConvertKit, Mailchimp, ActiveCampaign | HTML templates, plain text |
| SEO | Google Search Console, Ahrefs, SEMrush | JSON-LD, sitemaps, canonical URLs |

## Content Directory Structure

```
my-content-project/
├── .rune/                    # ACE state files
│   ├── decisions.md          # Content decisions log
│   ├── progress.md           # Current workflow status
│   └── conventions.md        # Brand voice, style guide
├── content/
│   ├── research/             # Phase 1 outputs
│   │   ├── [topic]-keywords.json
│   │   ├── [topic]-competitors.md
│   │   ├── [topic]-sources.md
│   │   └── [topic]-questions.md
│   ├── outlines/             # Phase 2 outputs
│   │   ├── [topic]-outline.md
│   │   └── video-script-outline.md
│   ├── drafts/               # Phase 3-4 outputs
│   │   ├── [topic]-v1.md
│   │   ├── [topic]-v2-optimized.md
│   │   └── tiktok-script-draft.md
│   ├── published/            # Phase 6 outputs
│   │   ├── 2025-03-18-ai-productivity.md
│   │   └── 2025-03-20-tiktok-script.md
│   └── email/                # Email-specific content
│       └── welcome-sequence/
│           ├── email-1-welcome.md
│           ├── email-2-feature.md
│           └── ...
├── assets/                   # Visual assets
│   ├── blog/
│   │   ├── featured-image.png
│   │   ├── twitter-card.png
│   │   └── linkedin-card.png
│   ├── social/
│   │   ├── instagram-post.png
│   │   └── facebook-cover.png
│   └── video/
│       ├── thumbnail.png
│       └── end-card.png
└── extensions/
    └── ace/
        ├── PACK.md           # This file
        └── skills/
            ├── content-cook.md
            ├── content-research.md
            ├── content-outline.md
            ├── content-draft.md
            ├── content-optimize.md
            ├── content-publish.md
            └── visual-assets.md
```

## Constraints

1. **MUST NOT reference codebase features** — ACE creates standalone content, not software documentation
2. **MUST base all claims on research data** — No fabrication of statistics, quotes, or case studies
3. **MUST present outline before drafting** — User approval gate prevents wasted drafting time
4. **MUST run optimization phase before publishing** — Quality enforcement
5. **MUST save all versions** — Research → Outline → Draft v1 → Draft v2 → Published (version history)
6. **MUST cite source URLs** — Every statistic, quote, or data point requires attribution
7. **MUST follow brand voice contract** — Consistency across all content pieces

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Fabricating statistics or quotes | CRITICAL | Phase 1 research must cite real sources with URLs; hallucination-guard verification |
| Skipping outline approval | HIGH | Phase 2 gate blocks drafting without explicit "approved" from user |
| Publishing without optimization | HIGH | Phase 4 mandatory checkpoint before Phase 6 |
| Not saving version history | MEDIUM | All drafts saved with version numbers (v1, v2, final); git commit after publish |
| Generic advice without specifics | MEDIUM | Phase 1 research must find niche-specific data points and examples |
| Inconsistent brand voice | MEDIUM | Brand voice contract created in Phase 1; applied to all subsequent phases |
| Platform-inappropriate formatting | HIGH | Platform constraints documented in each workflow chain; validation in Phase 6 |
| SEO keyword stuffing | HIGH | Optimization phase includes density checks (target: 1-2% primary keyword) |

## Mesh Protocol (ACE-Specific)

### Loop Prevention

```
Rule 1: No self-calls (content-cook cannot call itself)
Rule 2: Max 2 visits to same L3 skill per workflow
Rule 3: Max chain depth: 6 phases (Research → Outline → Draft → Optimize → Assets → Publish)
Rule 4: If blocked → escalate to user for decision
```

### Model Auto-Selection

```
Research / data gathering?     → haiku   (cheap, fast)
Outline / structure?           → sonnet  (balanced reasoning)
Drafting / writing?            → sonnet  (default for quality)
Optimization / editing?        → sonnet  (clarity + engagement)
Visual assets?                 → sonnet  (creative generation)
Publishing / formatting?       → haiku   (mechanical task)

Override: premium mode → always opus for drafting
Override: budget mode → haiku for outlining (faster, lower quality)
```

### Parallel Execution

| Context | Max Parallel | Reason |
|---------|-------------|--------|
| L3 research tasks | 3 | Independent searches can run simultaneously |
| L3 drafting sections | 1 | Writing must maintain narrative flow |
| L3 optimization passes | 2 | Clarity + SEO can run parallel |
| L3 asset generation | 3 | Multiple images can generate concurrently |

## Quality Gates

### Gate 1: Research Completeness

Before proceeding to Outline, verify:
- [ ] 10+ competitor articles analyzed
- [ ] 10+ statistics found with source URLs
- [ ] 5+ expert quotes identified
- [ ] 10+ audience questions collected
- [ ] Search volume data obtained for target keywords

### Gate 2: Outline Approval

Before proceeding to Draft, verify:
- [ ] H2/H3 structure complete
- [ ] Word count estimates per section
- [ ] Data/sources mapped to sections
- [ ] User explicitly approved outline (type "approved" or "go")

### Gate 3: Draft Quality

Before proceeding to Optimize, verify:
- [ ] Follows approved outline structure
- [ ] All statistics properly cited
- [ ] Examples/case studies included
- [ ] Hook introduction (first 100 words compelling)
- [ ] Clear CTA in conclusion

### Gate 4: Optimization Score

Before proceeding to Publish, verify:
- [ ] Flesch reading ease score > 60
- [ ] Paragraphs average < 4 lines
- [ ] SEO meta title/description present
- [ ] Heading hierarchy correct (H1 → H2 → H3)
- [ ] Keyword density 1-2% (no stuffing)

### Gate 5: Publishing Readiness

Before emitting final output, verify:
- [ ] All files saved to correct directories
- [ ] Version history preserved
- [ ] Visual assets generated
- [ ] Platform-specific formatting applied
- [ ] Publishing checklist emitted

## Cost Profile

| Workflow | Input Tokens | Output Tokens | Total Cost (Sonnet) |
|----------|-------------|---------------|---------------------|
| Blog Post (full) | ~6,000 | ~4,000 | ~$0.15 |
| Social Media | ~3,000 | ~2,000 | ~$0.08 |
| Video Script | ~8,000 | ~5,000 | ~$0.20 |
| Email Sequence | ~4,000 | ~3,000 | ~$0.12 |
| Repurpose Content | ~5,000 | ~3,000 | ~$0.14 |

**Cost Optimization Tips:**
- Use `haiku` for research phases (50% cheaper)
- Skip visual assets if not needed (saves ~2,000 tokens)
- Use Fast Mode for simple social posts (skip outline phase)
- Batch multiple pieces in one session (amortize research cost)

## Comparison with Traditional Content Workflows

| Metric | Traditional (Human) | ACE | Improvement |
|--------|--------------------|-----|-------------|
| Research time | 2-3 hours | 5-8 minutes | **20x faster** |
| Outline creation | 30-60 minutes | 3-5 minutes | **10x faster** |
| First draft | 2-4 hours | 8-12 minutes | **15-20x faster** |
| Editing/optimization | 1-2 hours | 5-8 minutes | **12-15x faster** |
| Visual assets | 1-2 hours (designer) | 3-5 minutes | **20-25x faster** |
| **Total time** | **6-11 hours** | **20-35 minutes** | **15-20x faster** |
| Cost (outsourced) | $200-500/article | ~$0.15/token | **99% cheaper** |
| Consistency | Variable | Always follows brand voice | **100% consistent** |
| SEO optimization | Manual audit | Automated checklist | **Zero missed items** |

## Example Usage

### Example 1: Create Blog Post

```bash
# Start workflow
/rune content-cook blog "How to Use AI for Productivity"

# ACE executes automatically:
Phase 1: RESEARCH
  ✓ Searches Google for "AI productivity tips"
  ✓ Finds top 10 ranking articles
  ✓ Extracts statistics from studies
  ✓ Saves to: content/research/ai-productivity-*

Phase 2: OUTLINE
  ✓ Creates structure with H2/H3 headings
  ✓ Estimates 2000 words total
  ✓ Maps statistics to sections
  ⏳ Waits for your approval (type "approved" to continue)

Phase 3: DRAFT
  ✓ Writes 2000-word article
  ✓ Includes all statistics with citations
  ✓ Adds examples and case studies
  ✓ Saves to: content/drafts/ai-productivity-v1.md

Phase 4: OPTIMIZE
  ✓ Improves readability (Flesch score: 65)
  ✓ Adds SEO metadata
  ✓ Inserts internal linking suggestions
  ✓ Saves to: content/drafts/ai-productivity-v2.md

Phase 5: VISUAL ASSETS
  ✓ Creates featured image (1200×630)
  ✓ Creates Twitter + LinkedIn cards
  ✓ Saves to: assets/ai-productivity/

Phase 6: PUBLISH
  ✓ Formats as Markdown with frontmatter
  ✓ Generates publishing checklist
  ✓ Saves to: content/published/2025-03-18-ai-productivity.md

# Output: Complete blog post ready to publish
# Total time: 18 minutes
# Token cost: ~10,500 tokens (~$0.18)
```

### Example 2: Repurpose Blog → TikTok

```bash
# Turn existing blog post into TikTok script
/rune content-cook repurpose "Convert AI productivity blog to TikTok script"

# Flow:
1. Loads existing blog post from content/published/
2. Identifies key hook ("2.5 hours wasted daily")
3. Adapts for TikTok 60-second format:
   - 0:00-0:03: Hook with shocking stat
   - 0:03-0:15: Quick problem demo
   - 0:15-0:45: Show 1 AI tool in action
   - 0:45-0:60: CTA ("Comment 'AI' for free guide")
4. Generates shot list with screen recordings
5. Saves to: content/scripts/tiktok-ai-productivity.md

# You then: Record screen, edit in CapCut, post to TikTok
# Total time: 8 minutes
```

### Example 3: Create Email Welcome Sequence

```bash
# Create 5-email welcome sequence
/rune content-cook email "5-email welcome sequence for SaaS product"

# Output:
Phase 1: RESEARCH competitor welcome emails
Phase 2: DRAFT all 5 emails (no outline for email)
Phase 3: OPTIMIZE subject lines + mobile formatting
Phase 4: PUBLISH as CSV for import to ConvertKit

Email 1: Welcome + quick win (send immediately)
Email 2: Feature spotlight (day 2)
Email 3: Customer success story (day 4)
Email 4: Advanced tip (day 7)
Email 5: Upgrade offer (day 10)

# Each email includes:
- Subject line (A/B test variant)
- Body copy (~300 words)
- CTA button
- Plain-text version
# Total time: 12 minutes
```

## Migration from Other Rune Workflows

If you're familiar with standard Rune `cook` workflow:

| Standard Cook | ACE content-cook | Notes |
|--------------|------------------|-------|
| Phase 1: UNDERSTAND (codebase) | Phase 1: RESEARCH (web data) | No code scanning |
| Phase 2: PLAN (architecture) | Phase 2: OUTLINE (content structure) | No technical design |
| Phase 3: TEST (TDD) | **SKIPPED** | No tests for content |
| Phase 4: IMPLEMENT | Phase 3: DRAFT | Writing instead of coding |
| Phase 5: QUALITY | Phase 4: OPTIMIZE | Editing instead of refactoring |
| Phase 6: VERIFY | Phase 5: VISUAL ASSETS | Images instead of tests |
| Phase 7: COMMIT | Phase 6: PUBLISH | Publishing instead of git commit |

**Key Differences:**
- No TDD (tests don't apply to content)
- No security audits (unless sensitive topics)
- No build/test commands
- Focus on engagement metrics instead of code quality

## Extending ACE

### Adding New Content Types

To add a new content type (e.g., podcast show notes):

1. Create workflow chain definition in `content-cook`:
```markdown
/rune content-cook podcast   → Podcast show notes + episode plan
```

2. Define phases:
```
Phase 1: RESEARCH → successful podcast patterns
Phase 2: OUTLINE → episode structure + segments
Phase 3: DRAFT → show notes + timestamps
Phase 4: OPTIMIZE → SEO for podcast platforms
Phase 5: ASSETS → episode artwork
Phase 6: PUBLISH → format for Spotify/Apple Podcasts
```

3. Document in this PACK.md under "Workflow Chains"

### Adding Platform Support

To add support for a new platform (e.g., Pinterest):

1. Research platform constraints:
   - Image sizes (1000×1500 for pins)
   - Text overlay best practices
   - Rich Pins metadata

2. Add to `visual-assets` skill:
```markdown
### Pinterest Presets
- Pin size: 1000×1500px (2:3 aspect ratio)
- Text overlay: bold, high contrast
- Rich Pins: recipe, product, article metadata
```

3. Update platform comparison tables

## Troubleshooting

### Common Issues

**Problem**: Research finds generic information only

**Solution**: Narrow topic specificity. Instead of "AI productivity," try "AI productivity for freelance designers using Figma."

**Problem**: Outline feels too rigid, stifling creativity

**Solution**: Mark sections as "[FLEX]" in outline — allows creative deviation during drafting while maintaining overall structure.

**Problem**: Optimized draft loses original voice

**Solution**: Create brand voice contract in Phase 1 with specific examples. Reference during optimization: "Maintain [specific voice trait]."

**Problem**: Visual assets don't match brand colors

**Solution**: Provide color palette hex codes in Phase 1. ACE will use these for all generated images.

**Problem**: Publishing checklist overwhelming

**Solution**: Use Fast Mode for simple posts — skip checklist, publish directly from draft.

## Done When

- Content created without any code changes
- All files saved to `content/` directory structure
- Research data properly cited with source URLs
- User has explicitly approved final version
- Ready to publish (formatted correctly for platform)
- Version history preserved (all drafts saved)
- Visual assets generated and saved
- Publishing checklist emitted

## Future Roadmap

### Phase 1 (v1.0) — Core Workflows ✅

- [x] Blog post pipeline
- [x] Social media pipeline
- [x] Video script pipeline
- [x] Email sequence pipeline
- [x] Repurposing workflow

### Phase 2 (v1.5) — Platform Expansion

- [ ] Pinterest pin creation
- [ ] Instagram carousel planning
- [ ] LinkedIn newsletter system
- [ ] Medium publication formatting
- [ ] Substack email templates

### Phase 3 (v2.0) — Advanced Features

- [ ] Multi-language content generation
- [ ] Long-form guide/ebook creation
- [ ] Webinar script + slide deck
- [ ] Course curriculum planning
- [ ] Interactive content (quizzes, calculators)

### Phase 4 (v2.5) — Analytics Integration

- [ ] Performance tracking setup
- [ ] A/B test variant generation
- [ ] Engagement metric analysis
- [ ] Content gap identification
- [ ] ROI calculation per piece

## License

Free for personal and commercial use. Attribution appreciated but not required.

---

**Created by**: Rune Development Team  
**Version**: 1.0.0  
**Last Updated**: March 18, 2025
