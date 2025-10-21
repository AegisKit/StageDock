#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'dist', 'preload', 'preload', 'index.js');
const target = path.join(rootDir, 'dist', 'preload', 'preload', 'index.cjs');

function copyPreload() {
  if (!fs.existsSync(source)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

copyPreload();

if (process.argv.includes('--watch')) {
  try {
    fs.watch(path.dirname(source), { persistent: true }, () => {
      copyPreload();
    });
  } catch (error) {
    console.error('Failed to watch preload build output', error);
  }
}
