import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist", "renderer");
const rendererDistDir = path.resolve(rootDir, "renderer", "dist");

async function clean() {
  await rm(distDir, { recursive: true, force: true }).catch(() => {});
}

async function copy() {
  await mkdir(path.dirname(distDir), { recursive: true });
  await rm(distDir, { recursive: true, force: true });

  // Reactアプリケーションのdistディレクトリをコピー
  try {
    await cp(rendererDistDir, distDir, { recursive: true });
    console.log("Copied React build to dist/renderer");
  } catch (error) {
    console.error("Failed to copy React build:", error);
    throw error;
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
    console.error(
      `Unknown prepare-react-renderer task: ${task ?? "(missing)"}`
    );
    process.exit(1);
}
