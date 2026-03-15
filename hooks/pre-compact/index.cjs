// Rune Pre-Compact Hook
// Saves critical state BEFORE Claude auto-compacts context window.
// Prevents data loss from losing decisions, progress, and metrics mid-session.
//
// Captures: context-watch state, active task summary, decisions made this session.
// Writes snapshot to .rune/pre-compact-snapshot.md for post-compact recovery.

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const runeDir = path.join(cwd, '.rune');

// Read context-watch state (tool counts, session timing)
const hash = Buffer.from(cwd).toString('base64url').slice(0, 16);
const counterFile = path.join(os.tmpdir(), `rune-context-watch-${hash}.json`);

let watchState = null;
try {
  const raw = fs.readFileSync(counterFile, 'utf-8');
  watchState = JSON.parse(raw);
} catch {
  // No counter file — session may be fresh
}

// Collect .rune/ state summaries
const stateFiles = ['progress.md', 'decisions.md', 'conventions.md'];
const summaries = [];

if (fs.existsSync(runeDir)) {
  for (const file of stateFiles) {
    const filePath = path.join(runeDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        if (content.length > 0) {
          // Take first 50 lines to keep snapshot compact
          const lines = content.split('\n').slice(0, 50);
          summaries.push({ file, preview: lines.join('\n') });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

// Build snapshot
const snapshot = [];
snapshot.push('# Pre-Compact Snapshot');
snapshot.push(`Generated: ${new Date().toISOString()}`);
snapshot.push('');

if (watchState) {
  snapshot.push('## Session Metrics');
  snapshot.push(`- Tool calls: ${watchState.count || 0}`);
  snapshot.push(`- Session start: ${watchState.sessionStart || 'unknown'}`);
  if (watchState.toolCounts) {
    const top5 = Object.entries(watchState.toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    snapshot.push(`- Top tools: ${top5.map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }
  snapshot.push('');
}

if (summaries.length > 0) {
  snapshot.push('## State Files (preview)');
  for (const { file, preview } of summaries) {
    snapshot.push(`### .rune/${file}`);
    snapshot.push(preview);
    snapshot.push('');
  }
}

// Write snapshot if we have anything worth saving
if (watchState || summaries.length > 0) {
  try {
    if (!fs.existsSync(runeDir)) {
      fs.mkdirSync(runeDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(runeDir, 'pre-compact-snapshot.md'),
      snapshot.join('\n')
    );
    console.log(`[Rune pre-compact] State snapshot saved (${watchState ? watchState.count : 0} tool calls, ${summaries.length} state files).`);
  } catch (e) {
    console.error(`[Rune pre-compact] Failed to save snapshot: ${e.message}`);
  }
} else {
  console.log('[Rune pre-compact] No state to snapshot — fresh session.');
}

process.exit(0);
