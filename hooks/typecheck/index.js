// Rune TypeScript Check Hook
// PostToolUse hook on Edit/Write — runs tsc --noEmit after .ts/.tsx file edits
//
// Only runs if tsconfig.json exists in the project.
// Async hook — doesn't block the agent, just warns.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = input.file_path || input.filePath || '';

// Only check TypeScript files
if (!/\.(ts|tsx)$/i.test(filePath)) {
  process.exit(0);
}

// Find tsconfig.json by walking up from the file
let dir = path.dirname(filePath);
let tsConfigDir = null;

for (let i = 0; i < 10; i++) {
  if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
    tsConfigDir = dir;
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

if (!tsConfigDir) {
  // No tsconfig.json found — skip
  process.exit(0);
}

// Run tsc --noEmit
try {
  execSync('npx tsc --noEmit --pretty 2>&1', {
    cwd: tsConfigDir,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 30000,
  });
  // Silent success
} catch (e) {
  const output = (e.stdout || e.message || '').trim();
  const errorLines = output.split('\n').filter(l => /error TS\d+/.test(l));
  const errorCount = errorLines.length;

  if (errorCount > 0) {
    console.log(`\n[Rune typecheck] ${errorCount} TypeScript error(s) after editing ${path.basename(filePath)}:`);
    // Show first 5 errors
    errorLines.slice(0, 5).forEach(line => {
      console.log(`  ${line.trim()}`);
    });
    if (errorCount > 5) {
      console.log(`  ... and ${errorCount - 5} more. Run \`npx tsc --noEmit\` for full list.`);
    }
    console.log('');
  }
}

process.exit(0);
