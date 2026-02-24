// Rune Session Start Hook
// Loads .rune/ state files if they exist in the project directory

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const runeDir = path.join(cwd, '.rune');

if (fs.existsSync(runeDir)) {
  const stateFiles = [
    'progress.md',
    'decisions.md',
    'conventions.md',
    'RESCUE-STATE.md'
  ];
  const loaded = [];

  for (const file of stateFiles) {
    const filePath = path.join(runeDir, file);
    if (fs.existsSync(filePath)) {
      loaded.push(file);
    }
  }

  if (loaded.length > 0) {
    console.log(`Rune: Loaded project state (${loaded.join(', ')})`);
  } else {
    console.log('Rune: Project initialized but no state files yet.');
  }
} else {
  console.log('Rune: No .rune/ directory found. Run /rune onboard to set up.');
}
