import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mainPath = path.join(process.cwd(), 'electron', 'main.ts');
const source = fs.readFileSync(mainPath, 'utf8');

const requiredContracts = [
  "let mainWindowMode: 'hud' | 'editor' | null = null",
  'let isQuitting = false',
  "registerMainWindow(createEditorWindow(), 'editor')",
  "registerMainWindow(createHudOverlayWindow(), 'hud')",
  "if (mode === 'editor' && !isQuitting)",
  'if (!mainWindow && !isQuitting)',
  "app.on('before-quit'",
  'showOrCreateMainWindow()',
];

for (const contract of requiredContracts) {
  assert(source.includes(contract), `Missing Electron window lifecycle contract: ${contract}`);
}

assert(
  source.indexOf("registerMainWindow(createEditorWindow(), 'editor')")
    < source.indexOf('previousWindow.close()'),
  'The replacement editor must be registered before the HUD closes.',
);

console.log('Electron editor-to-HUD lifecycle contract verified.');
