// Rune Pre-Tool Guard Hook — Privacy Mesh
// Three-tier security gate: ALLOW / WARN / BLOCK
// Configurable via .rune/privacy.json per project
// Skill-aware: sentinel/review can access files other skills cannot
//
// Upgrades over basic path matching:
// - Per-project .rune/privacy.json config (custom patterns + overrides)
// - Three tiers: ALLOW (silent), WARN (log), BLOCK (exit code 2)
// - Content-aware: scans first bytes for secret patterns on WARN files
//
// Gate-outcome capture:
// - BLOCK events are appended to .rune/metrics/gate-outcomes.jsonl (best-effort)
// - passed/bypassed outcomes are NOT captured here (not observable at this layer)

const fs = require('fs');
const path = require('path');

/**
 * Append a structured gate-outcome record to .rune/metrics/gate-outcomes.jsonl
 * relative to process.cwd(). Best-effort: any error is silently swallowed so
 * that capture NEVER affects the BLOCK decision or exit code.
 *
 * @param {string} gate  - Gate name (e.g. "privacy-mesh")
 * @param {string} outcome - "blocked" (only outcome captured here)
 * @param {string} detail - Short human-readable reason
 */
function appendGateOutcome(gate, outcome, detail) {
  try {
    const outDir = path.join(process.cwd(), '.rune', 'metrics');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'gate-outcomes.jsonl');
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      gate,
      outcome,
      detail: String(detail).slice(0, 200), // cap length; no PII in detail
    });
    fs.appendFileSync(outFile, entry + '\n');

    // Bound file to last 500 lines so it never grows unbounded.
    // Synchronous read-trim-write, fully inside this try/catch — NEVER throws,
    // NEVER affects the BLOCK decision or exit code.
    const raw = fs.readFileSync(outFile, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length > 500) {
      fs.writeFileSync(outFile, lines.slice(-500).join('\n') + '\n');
    }
  } catch {
    // Capture is best-effort. NEVER throw, NEVER affect exit code.
  }
}

/**
 * Path a Codex `apply_patch` call is about to write.
 *
 * Codex has no Edit/Write tool — file writes arrive as one `apply_patch` call
 * whose payload is raw patch text, so there is no `file_path` to read. The
 * target is in the patch header. Without this the privacy gate is a no-op on
 * Codex: every write sails past.
 *
 * @param {string} toolName
 * @param {object} toolInput
 * @returns {string} target path, or '' when this is not a patch we understand
 */
function patchTargetPath(toolName, toolInput) {
  if (toolName !== 'apply_patch') return '';
  const patch = typeof toolInput === 'string' ? toolInput : toolInput.input || toolInput.patch || '';
  if (typeof patch !== 'string') return '';
  const match = patch.match(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

// Read tool_input from Claude Code hook stdin
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let toolInput = {};
  let toolName = '';
  try {
    const parsed = JSON.parse(input);
    toolInput = parsed.tool_input || parsed;
    toolName = parsed.tool_name || '';
  } catch {
    // If no stdin or parse fails, exit cleanly (non-blocking)
    process.exit(0);
  }

  const filePath = toolInput.file_path || toolInput.path || patchTargetPath(toolName, toolInput);
  if (!filePath) process.exit(0);

  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, '/');

  // Load project-specific privacy config
  const privacyConfig = loadPrivacyConfig();

  // Default sensitive file patterns — BLOCK tier (hard block)
  const blockPatterns = [
    /^id_rsa$/,
    /^id_ed25519$/,
    /^id_ecdsa$/,
    /\.p12$/,
    /\.pfx$/,
    /\.pem$/,
    /^\.netrc$/,
    /private[-_.]?key/i,
    ...privacyConfig.block.map((p) => new RegExp(p)),
  ];

  // WARN tier (log warning, allow through)
  const warnPatterns = [
    /^\.env$/,
    /^\.env\.[^e]/,                  // .env.* but NOT .env.example
    /\.key$/,
    /^credentials\.json$/,
    /\.secret$/,
    /secret[-_.]?key/i,
    ...privacyConfig.warn.map((p) => new RegExp(p)),
  ];

  // Safe exceptions (always allow)
  const safeExceptions = [
    /\.env\.example$/,
    /\.env\.sample$/,
    /\.env\.template$/,
    /\.env\.test$/,
    /test.*credential/i,
    /fixture/i,
    /mock/i,
    ...privacyConfig.allow.map((p) => new RegExp(p)),
  ];

  // Skills with elevated access (can read WARN-tier files without warning)
  const elevatedSkills = new Set([
    'sentinel', 'review', 'audit', 'secrets-scan', 'onboard',
    ...privacyConfig.elevatedSkills,
  ]);

  // Detect active skill from environment (set by metrics-collector or skill invocation)
  const activeSkill = process.env.RUNE_ACTIVE_SKILL || '';
  const isElevated = elevatedSkills.has(activeSkill);

  const isSafe = safeExceptions.some((p) => p.test(basename) || p.test(normalized));
  if (isSafe) process.exit(0);

  const isBlocked = blockPatterns.some((p) => p.test(basename) || p.test(normalized));
  if (isBlocked) {
    // Append block outcome BEFORE printing/exiting — fail-safe, never affects exit code.
    // Only "blocked" is captured here; "passed" and "bypassed" are not observable
    // at this layer and intentionally remain uncaptured (see GAP-1 in governance-collector.js).
    appendGateOutcome('privacy-mesh', 'blocked', `file matched BLOCK-tier pattern: ${basename}`);

    console.log(`\n🚫 [Rune privacy-mesh] BLOCKED: ${filePath}`);
    console.log('  This file matches a BLOCK-tier pattern (private keys, certificates).');
    console.log('  Override: add path to .rune/privacy.json "allow" list if intentional.\n');
    process.exit(2); // Exit code 2 = BLOCK
  }

  const isWarned = warnPatterns.some((p) => p.test(basename) || p.test(normalized));
  if (isWarned && !isElevated) {
    // Content-aware check: scan first 4KB for secret patterns
    const contentWarning = scanContentForSecrets(filePath);

    console.log(`\n⚠ [Rune privacy-mesh] Sensitive file: ${filePath}`);
    if (contentWarning) {
      console.log(`  Content scan: ${contentWarning}`);
    }
    console.log('  This file may contain secrets. Confirm access is intentional.');
    console.log('  Elevated skills (sentinel, review, audit) bypass this warning.\n');
  }

  process.exit(0);
});

/**
 * Load .rune/privacy.json from project root
 * Returns merged config with defaults
 */
function loadPrivacyConfig() {
  const defaults = { block: [], warn: [], allow: [], elevatedSkills: [] };

  const candidates = [
    path.join(process.cwd(), '.rune', 'privacy.json'),
    path.join(process.cwd(), 'privacy.json'),
  ];

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
          block: Array.isArray(raw.block) ? raw.block : defaults.block,
          warn: Array.isArray(raw.warn) ? raw.warn : defaults.warn,
          allow: Array.isArray(raw.allow) ? raw.allow : defaults.allow,
          elevatedSkills: Array.isArray(raw.elevatedSkills) ? raw.elevatedSkills : defaults.elevatedSkills,
        };
      }
    } catch {
      // Invalid config — use defaults
    }
  }

  return defaults;
}

/**
 * Scan first 4KB of a file for common secret patterns
 * Returns a warning string if secrets detected, null otherwise
 */
function scanContentForSecrets(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);

    if (bytesRead === 0) return null;

    const content = buffer.toString('utf-8', 0, bytesRead);

    const secretPatterns = [
      { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
      { pattern: /gh[ps]_[A-Za-z0-9_]{36,}/, label: 'GitHub token' },
      { pattern: /sk_(live|test)_[0-9a-zA-Z]{24,}/, label: 'Stripe key' },
      { pattern: /-----BEGIN .* PRIVATE KEY-----/, label: 'Private key' },
      { pattern: /xox[bpors]-[0-9a-zA-Z-]{10,}/, label: 'Slack token' },
      { pattern: /sk-[a-zA-Z0-9]{32,}/, label: 'OpenAI/API key' },
    ];

    for (const { pattern, label } of secretPatterns) {
      if (pattern.test(content)) {
        return `Found ${label} pattern in file content`;
      }
    }
  } catch {
    // Can't read file (doesn't exist yet, permissions, etc.) — skip silently
  }

  return null;
}
