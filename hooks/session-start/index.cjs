// Rune Session Start Hook
// Loads and injects .rune/ state file CONTENTS into context at session start

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const runeDir = path.join(cwd, '.rune');

// The context-watch counter is now keyed by the Claude Code session_id (see
// hooks/lib/context-key.cjs), so each new session starts with a fresh counter
// automatically — no explicit reset is needed here. (Previously this block
// reset a cwd-keyed file, which bled across sessions in the same directory.)

if (fs.existsSync(runeDir)) {
  const stateFiles = [
    'progress.md',
    'decisions.md',
    'conventions.md',
    'RESCUE-STATE.md',
    'DEVELOPER-GUIDE.md',
    'logic-manifest.json'
  ];
  const loaded = [];

  for (const file of stateFiles) {
    const filePath = path.join(runeDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      if (content.length > 0) {
        console.log(`\n=== .rune/${file} ===\n${content}`);
        loaded.push(file);
      }
    }
  }

  // Inject active behavioral context mode
  const activeContextFile = path.join(runeDir, 'active-context.md');
  if (fs.existsSync(activeContextFile)) {
    try {
      const mode = fs.readFileSync(activeContextFile, 'utf-8').trim();
      if (mode) {
        // Look for the context file in plugin's contexts/ directory
        const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..', '..');
        const contextFile = path.join(pluginRoot, 'contexts', `${mode}.md`);
        if (fs.existsSync(contextFile)) {
          const contextContent = fs.readFileSync(contextFile, 'utf-8').trim();
          console.log(`\n=== Active Context: ${mode} mode ===\n${contextContent}`);
          loaded.push(`active-context(${mode})`);
        }
      }
    } catch {
      // Non-critical — skip silently
    }
  }

  if (loaded.length > 0) {
    console.log(`\n[Rune: injected project state from ${loaded.join(', ')}]`);
  } else {
    console.log('[Rune: .rune/ directory found but no state files yet. Run /rune onboard to populate.]');
  }
} else {
  console.log('[Rune: No .rune/ directory found. Run /rune onboard to set up project context.]');
}

// Tier detection hint (v2.17.1+) — Pro/Business plugins live in private repos
// and aren't auto-loaded like the Free plugin. If detected at sibling / env /
// well-known path AND tier hooks aren't already wired in settings.json, nudge
// user toward `rune setup`. Self-suppressing — once wired, the check fails and
// the hint stops firing.
detectTierHint();

function detectTierHint() {
  const envVars = { pro: 'RUNE_PRO_ROOT', business: 'RUNE_BUSINESS_ROOT' };
  const wellKnown = {
    pro: [
      'D:/Project/Rune/Pro',
      path.join(os.homedir(), 'rune-pro'),
      path.join(os.homedir(), 'Project', 'Rune', 'Pro'),
    ],
    business: [
      'D:/Project/Rune/Business',
      path.join(os.homedir(), 'rune-business'),
      path.join(os.homedir(), 'Project', 'Rune', 'Business'),
    ],
  };

  const detected = [];
  for (const tier of ['pro', 'business']) {
    let manifest = null;
    let source = null;

    const fromEnv = process.env[envVars[tier]];
    if (fromEnv) {
      const m = path.join(fromEnv, 'hooks', 'manifest.json');
      if (fs.existsSync(m)) {
        manifest = m;
        source = `$${envVars[tier]}`;
      }
    }
    if (!manifest) {
      const m = path.join(cwd, '..', tier === 'pro' ? 'Pro' : 'Business', 'hooks', 'manifest.json');
      if (fs.existsSync(m)) {
        manifest = m;
        source = 'sibling';
      }
    }
    if (!manifest) {
      for (const root of wellKnown[tier]) {
        const m = path.join(root, 'hooks', 'manifest.json');
        if (fs.existsSync(m)) {
          manifest = m;
          source = 'well-known';
          break;
        }
      }
    }

    if (manifest) {
      detected.push({ tier, source, version: readManifestVersion(manifest) });
    }
  }

  if (detected.length === 0) return;

  // Suppress hint if any tier hook already wired (project-local OR global)
  const tierEnvRe = /\$\{RUNE_[A-Z][A-Z0-9_]*_ROOT\}/;
  const settingsPaths = [path.join(cwd, '.claude', 'settings.json'), path.join(os.homedir(), '.claude', 'settings.json')];
  for (const settingsPath of settingsPaths) {
    if (!fs.existsSync(settingsPath)) continue;
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      if (tierEnvRe.test(content)) return;
    } catch {
      // ignore unreadable settings.json — fall through to print hint
    }
  }

  console.log('\n=== Rune Tier Hint ===');
  for (const { tier, source, version } of detected) {
    const cap = tier.charAt(0).toUpperCase() + tier.slice(1);
    console.log(`${cap} detected: ${source} (v${version})`);
  }
  const tierFlag = detected.map((d) => d.tier).join(',');
  console.log(`Wire it: \`npx @rune-kit/rune setup --global --tier ${tierFlag}\``);
  console.log('(adds tier-specific hooks: autopilot circuit-breaker, context-sense, statusline)');
}

function readManifestVersion(manifestPath) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}
