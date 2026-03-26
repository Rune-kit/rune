// Rune Intent Router Hook — Compiled Intent Mesh (CIM)
// Auto-suggests skill routing based on user prompt analysis
// Runs as UserPromptSubmit hook — scores prompt against compiled skill-index.json
//
// Key difference from runtime scoring approaches:
// - Compile-time generated index (zero runtime deps)
// - Mesh-aware chain prediction (uses actual connection graph)
// - Works on all platforms (index ships with every build)

const fs = require('fs');
const path = require('path');

// Read user prompt from Claude Code hook stdin
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let userPrompt = '';
  try {
    const parsed = JSON.parse(input);
    userPrompt = parsed.user_prompt || parsed.prompt || parsed.content || '';
  } catch {
    // Raw text input
    userPrompt = input.trim();
  }

  if (!userPrompt || userPrompt.length < 3) {
    process.exit(0);
  }

  // Find skill-index.json — check multiple locations
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '../..');
  const candidates = [
    path.join(pluginRoot, '.cursor', 'rules', 'skill-index.json'),
    path.join(pluginRoot, '.windsurf', 'rules', 'skill-index.json'),
    path.join(pluginRoot, 'dist', 'cursor', 'skill-index.json'),
    path.join(pluginRoot, 'dist', 'generic', 'skill-index.json'),
    // Also check .rune/ for locally cached index
    path.join(process.cwd(), '.rune', 'skill-index.json'),
  ];

  let index = null;
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        index = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  if (!index || !index.intents) {
    // No index available — exit silently (not an error, just not built yet)
    process.exit(0);
  }

  // Score prompt against intent patterns
  const promptLower = userPrompt.toLowerCase();
  const scores = [];

  for (const [skillName, intent] of Object.entries(index.intents)) {
    let score = 0;

    for (const keyword of intent.keywords) {
      if (promptLower.includes(keyword)) {
        // Exact word boundary match scores higher
        const wordBoundary = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        score += wordBoundary.test(userPrompt) ? 3 : 1;
      }
    }

    // Layer priority boost: L1 orchestrators get a small bonus (they're entry points)
    if (intent.layer === 'L1') score += 1;

    if (score > 0) {
      scores.push({ skill: skillName, score, chain: intent.chain, model: intent.model, layer: intent.layer });
    }
  }

  if (scores.length === 0) {
    process.exit(0);
  }

  // Sort by score descending, take top match
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];

  // Only suggest if confidence is reasonable (score >= 3 = at least one strong keyword match)
  if (top.score < 3) {
    process.exit(0);
  }

  // Format chain for display
  const chainDisplay = top.chain.slice(0, 4).join(' → ');
  const alternates = scores.slice(1, 3).map((s) => s.skill).join(', ');

  // Output routing suggestion
  console.log(`\n🧭 [Rune intent-router] Suggested: rune:${top.skill} (${top.layer}, ${top.model})`);
  console.log(`   Chain: ${chainDisplay}`);
  if (alternates) {
    console.log(`   Also consider: ${alternates}`);
  }
  console.log('');

  process.exit(0);
});
