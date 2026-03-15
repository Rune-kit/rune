// Rune Auto-Format Hook
// PostToolUse hook on Edit/Write — runs Prettier on JS/TS files after modification
//
// Only runs if Prettier is available in the project.
// Silent pass-through if not applicable.

const { execSync } = require('child_process');
const path = require('path');

const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = input.file_path || input.filePath || '';

// Only format JS/TS/JSON/CSS files
if (!/\.(js|jsx|ts|tsx|json|css|scss|md|html|yaml|yml)$/i.test(filePath)) {
  process.exit(0);
}

// Check if file exists and is within a project with Prettier
const dir = path.dirname(filePath);

// Try to find prettier in the project
let hasPrettier = false;
try {
  execSync('npx prettier --version', { cwd: dir, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
  hasPrettier = true;
} catch {
  // No Prettier available — skip silently
}

if (!hasPrettier) {
  process.exit(0);
}

// Run Prettier on the file
try {
  execSync(`npx prettier --write "${filePath}"`, {
    cwd: dir,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 10000,
  });
  // Silent success — formatted files are seamless
} catch (e) {
  // Prettier failed — non-critical, just warn
  console.log(`[Rune auto-format] Prettier failed on ${path.basename(filePath)}: ${e.message.split('\n')[0]}`);
}

process.exit(0);
