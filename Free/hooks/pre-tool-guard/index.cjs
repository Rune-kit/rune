// Rune Pre-Tool Guard Hook
// Preventive security gate — warns before AI reads/edits sensitive files
// Runs as PreToolUse hook for Read, Write, Edit tools

const path = require('path');

// Read tool_input from Claude Code hook stdin
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let toolInput = {};
  try {
    const parsed = JSON.parse(input);
    toolInput = parsed.tool_input || parsed;
  } catch {
    // If no stdin or parse fails, exit cleanly (non-blocking)
    process.exit(0);
  }

  const filePath = toolInput.file_path || toolInput.path || '';
  if (!filePath) process.exit(0);

  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, '/');

  // Sensitive file patterns
  const sensitivePatterns = [
    /^\.env$/,                         // .env exactly
    /^\.env\.[^e]/,                    // .env.* but NOT .env.example
    /\.pem$/,
    /\.key$/,
    /\.p12$/,
    /\.pfx$/,
    /^credentials\.json$/,
    /\.secret$/,
    /^\.netrc$/,
    /^id_rsa$/,
    /^id_ed25519$/,
    /^id_ecdsa$/,
    /^\.ssh\//,
    /private.*key/i,
    /secret.*key/i,
  ];

  // Exclude safe exceptions
  const safeExceptions = [
    /\.env\.example$/,
    /\.env\.sample$/,
    /\.env\.template$/,
    /\.env\.test$/,
    /test.*credential/i,
    /fixture/i,
    /mock/i,
  ];

  const isSensitive = sensitivePatterns.some((p) => p.test(basename) || p.test(normalized));
  const isSafe = safeExceptions.some((p) => p.test(basename) || p.test(normalized));

  if (isSensitive && !isSafe) {
    // Output warning to user — does NOT hard-block (developer may legitimately need access)
    console.log(`\n⚠ [Rune pre-tool-guard] Sensitive file detected: ${filePath}`);
    console.log('  This file may contain secrets. Confirm this access is intentional.');
    console.log('  If scanning for secrets, use /rune sentinel instead.\n');
  }

  process.exit(0);
});
