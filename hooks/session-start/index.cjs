// Rune Session Start Hook
// Loads and injects .rune/ state file CONTENTS into context at session start

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const runeDir = path.join(cwd, '.rune');

// Reset context-watch counter on session start (fresh context window)
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);
const counterFile = path.join(os.tmpdir(), `rune-context-watch-${hash}.json`);
try { fs.unlinkSync(counterFile); } catch { /* no counter yet — fine */ }

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
