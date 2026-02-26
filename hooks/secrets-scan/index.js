// Rune Secrets Scan Hook
// PreToolUse hook on Bash — intercepts git commit commands
// Scans staged files for hardcoded secrets before allowing commit
//
// Patterns based on gitleaks + common AI-generated secret leaks.
// Zero false-positive tolerance on BLOCK patterns.

const { execSync } = require('child_process');

// Only intercept git commit commands
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const command = (input.command || '').trim();

// Check if this is a git commit command
if (!/^git\s+commit\b/.test(command)) {
  // Not a commit — pass through
  process.exit(0);
}

// Get staged files
let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(f => f.length > 0);
} catch {
  // Not in a git repo or no staged files — pass through
  process.exit(0);
}

if (stagedFiles.length === 0) {
  process.exit(0);
}

// Secret patterns (high-confidence, low false-positive)
const BLOCK_PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', regex: /gh[ps]_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token', regex: /xox[bpors]-[0-9a-zA-Z-]{10,}/ },
  { name: 'Stripe Key', regex: /[sr]k_(live|test)_[0-9a-zA-Z]{24,}/ },
  { name: 'SendGrid Key', regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/ },
  { name: 'Twilio Key', regex: /SK[0-9a-fA-F]{32}/ },
  { name: 'Firebase Key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'OpenAI Key', regex: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Anthropic Key', regex: /sk-ant-[A-Za-z0-9_-]{32,}/ },
];

// Files to always skip (test fixtures, examples)
const SKIP_PATHS = /\/(test|tests|__tests__|fixtures|__mocks__|examples?|\.test\.|\.spec\.)/i;

// Scan staged content (not files on disk — staged content via git show)
const findings = [];

for (const file of stagedFiles) {
  // Skip test/fixture files
  if (SKIP_PATHS.test(file)) continue;

  // Skip binary files and lockfiles
  if (/\.(png|jpg|gif|ico|woff|ttf|lock|lockb)$/i.test(file)) continue;

  let content;
  try {
    content = execSync(`git show ":${file}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    continue; // File deleted or binary
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file,
          line: i + 1,
          pattern: pattern.name,
          snippet: line.substring(0, 80).trim(),
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('\n\u{1F6A8} [Rune secrets-scan] BLOCKED — hardcoded secrets detected in staged files:\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.pattern}`);
    console.error(`    ${f.snippet}...`);
  }
  console.error('\n  Fix: Remove secrets, use environment variables instead.');
  console.error('  Override: git commit --no-verify (NOT recommended)\n');

  // BLOCK the commit
  process.exit(2);
}

// No secrets found — allow commit
process.exit(0);
