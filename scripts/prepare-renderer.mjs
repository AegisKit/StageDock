import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist', 'renderer');
const exportDir = path.resolve(rootDir, 'renderer', 'out');
const nextDir = path.resolve(rootDir, 'renderer', '.next');

async function clean() {
  await rm(distDir, { recursive: true, force: true }).catch(() => {});
  await rm(exportDir, { recursive: true, force: true }).catch(() => {});
  await rm(nextDir, { recursive: true, force: true }).catch(() => {});
}

async function copy() {
  await mkdir(path.dirname(distDir), { recursive: true });
  await rm(distDir, { recursive: true, force: true });
  await cp(exportDir, distDir, { recursive: true });
}

const task = process.argv[2];

switch (task) {
  case 'clean':
    await clean();
    break;
  case 'copy':
    await copy();
    break;
  default:
    console.error(`Unknown prepare-renderer task: ${task ?? '(missing)'}`);
    process.exit(1);
}
