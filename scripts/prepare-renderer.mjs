import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist", "renderer");
const exportDir = path.resolve(rootDir, "renderer", "out");
const nextDir = path.resolve(rootDir, "renderer", ".next");
const standaloneDir = path.resolve(rootDir, "renderer", ".next", "standalone");

async function clean() {
  await rm(distDir, { recursive: true, force: true }).catch(() => {});
  await rm(exportDir, { recursive: true, force: true }).catch(() => {});
  await rm(nextDir, { recursive: true, force: true }).catch(() => {});
}

async function copy() {
  await mkdir(path.dirname(distDir), { recursive: true });
  await rm(distDir, { recursive: true, force: true });

  // standaloneモードの場合は.next/standaloneをコピー
  try {
    await cp(standaloneDir, distDir, { recursive: true });
    console.log("Copied standalone build to dist/renderer");
  } catch (error) {
    // フォールバック: outディレクトリをコピー
    try {
      await cp(exportDir, distDir, { recursive: true });
      console.log("Copied export build to dist/renderer");
    } catch (exportError) {
      console.error(
        "Failed to copy both standalone and export builds:",
        error,
        exportError
      );
      throw exportError;
    }
  }
}

const task = process.argv[2];

switch (task) {
  case "clean":
    await clean();
    break;
  case "copy":
    await copy();
    break;
  default:
    console.error(`Unknown prepare-renderer task: ${task ?? "(missing)"}`);
    process.exit(1);
}
