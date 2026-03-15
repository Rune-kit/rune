// Rune hook runner — loads and executes named hook modules
const path = require('path');

const hookName = process.argv[2];
if (!hookName) {
  console.error('Usage: run-hook <hook-name>');
  process.exit(1);
}

const hookPath = path.join(__dirname, hookName, 'index.cjs');
try {
  require(hookPath);
} catch (e) {
  console.error(`Rune hook "${hookName}" failed: ${e.message}`);
  process.exit(1);
}
