import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
// import { fileURLToPath } from "node:url";
import { autoUpdater } from "electron-updater";
// import { getPort } from "get-port-please";
// import { startServer } from "next/dist/server/lib/start-server";
import { logger } from "./utils/logger.js";
import { IPC_CHANNELS } from "../common/ipc.js";
import { StageDockDatabase } from "./database/database.js";
import { registerIpcHandlers } from "./services/ipc/handlers.js";
import { NotificationService } from "./services/notification.js";
import { LiveMonitor } from "./services/live-monitor.js";

// グローバル変数でリソースを管理
let database: StageDockDatabase | null = null;
let liveMonitor: LiveMonitor | null = null;
let notificationService: NotificationService | null = null;
let multiviewWindow: BrowserWindow | null = null;

function loadEnvFromFile(): void {
  const requiredKeys = [
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
    "YOUTUBE_API_KEY",
  ];
  const missing = requiredKeys.filter((key) => {
    const value = process.env[key];
    return !value || value.length === 0;
  });

  if (missing.length === 0) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    logger.debug({ envPath }, "No .env file found");
    return;
  }

  try {
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      if (!line || line.trim().length === 0 || line.trim().startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }

    logger.info({ envPath }, "Loaded configuration from .env file");
  } catch (error) {
    logger.warn({ error, envPath }, "Failed to load .env file");
  }
}

loadEnvFromFile();

const isDevelopment = !app.isPackaged;
const ELECTRON_RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
// CommonJSでは__filenameと__dirnameは自動的に利用可能
let mainWindow: BrowserWindow | null = null;
function resolvePreloadPath() {
  return path.join(__dirname, "../../preload/preload/index.cjs");
}

// Reactサーバーは不要 - 静的ファイルを直接読み込み

function resolveMultiviewUrl() {
  if (isDevelopment && ELECTRON_RENDERER_URL) {
    return `${ELECTRON_RENDERER_URL}/multiview-window`;
  }
  const indexPath = path.join(
    app.getAppPath(),
    "dist",
    "renderer",
    "index.html"
  );
  return `file://${indexPath}#/multiview-window`;
}

async function createMultiviewWindow(urls: string[], layout: string) {
  if (multiviewWindow) {
    multiviewWindow.focus();
    return;
  }

  const multiviewPreloadPath = resolvePreloadPath();
  logger.info({ multiviewPreloadPath }, "Multiview preload script path");

  multiviewWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101014" : "#ffffff",
    show: false,
    frame: true,
    titleBarStyle: "default",
    icon: path.join(__dirname, "../../assets/icon.png"), // アイコンを設定
    webPreferences: {
      preload: multiviewPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      partition: "persist:main",
    },
  });

  multiviewWindow.setTitle("StageDock Multi-view");

  // Content Security Policyを無効化
  multiviewWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;",
          ],
        },
      });
    }
  );

  // YouTube埋め込み用のReferer強制付与（一時的に無効化）
  // multiviewWindow.webContents.session.webRequest.onBeforeSendHeaders(
  //   (details, callback) => {
  //     if (
  //       details.url.includes("youtube.com") ||
  //       details.url.includes("googlevideo.com")
  //     ) {
  //       details.requestHeaders["Referer"] = "https://www.youtube.com/";
  //     }
  //     callback({ requestHeaders: details.requestHeaders });
  //   }
  // );

  multiviewWindow.on("ready-to-show", () => {
    multiviewWindow?.show();
    setTimeout(() => {
      multiviewWindow?.webContents.send("multiview:data", { urls, layout });
    }, 1000);
  });

  multiviewWindow.on("closed", () => {
    multiviewWindow = null;
  });

  const multiviewUrl = resolveMultiviewUrl();
  await multiviewWindow.loadURL(multiviewUrl);
}

export { createMultiviewWindow, multiviewWindow };
// function resolveRendererUrl() {
//   if (isDevelopment && ELECTRON_RENDERER_URL) {
//     return ELECTRON_RENDERER_URL;
//   }
//   // standaloneモードではNext.jsサーバーを使用
//   if (nextJSPort) {
//     return `http://localhost:${nextJSPort}`;
//   }
//   // フォールバック: 静的ファイル
//   const indexPath = path.join(
//     app.getAppPath(),
//     "dist",
//     "renderer",
//     "index.html"
//   );
//   return `file://${indexPath}`;
// }
async function createWindow() {
  const preloadPath = resolvePreloadPath();
  console.log("Preload script path:", preloadPath);
  logger.info({ preloadPath }, "Preload script path");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101014" : "#ffffff",
    show: false,
    frame: true, // フレームを有効にしてタイトルバーを表示
    titleBarStyle: "default", // デフォルトのタイトルバースタイル
    icon: path.join(__dirname, "../../assets/icon.png"), // アイコンを設定
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      partition: "persist:main",
    },
  });
  // ウィンドウタイトルを設定
  mainWindow.setTitle("StageDock");

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const loadURL = async () => {
    if (!mainWindow) return;

    try {
      if (isDevelopment && ELECTRON_RENDERER_URL) {
        logger.info({ url: ELECTRON_RENDERER_URL }, "Loading development URL");
        await mainWindow.loadURL(ELECTRON_RENDERER_URL);
      } else {
        // 本番環境では静的ファイルを直接読み込み
        logger.info("Loading React static files for production");
        const indexPath = path.join(
          app.getAppPath(),
          "dist",
          "renderer",
          "index.html"
        );
        if (existsSync(indexPath)) {
          logger.info({ indexPath }, "Loading renderer from static file");
          await mainWindow.loadURL(`file://${indexPath}`);
        } else {
          throw new Error("No renderer files found");
        }
      }
    } catch (error) {
      logger.error({ error }, "Failed to load renderer completely");
      // 最終的なフォールバック: エラーページ
      await mainWindow.loadURL(
        `data:text/html,<html><body><h1>StageDock</h1><p>Failed to load application. Please restart the app.</p></body></html>`
      );
    }
  };

  await loadURL();

  // Content Security Policyを無効化
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;",
          ],
        },
      });
    }
  );

  // YouTube埋め込み用のReferer強制付与（一時的に無効化）
  // mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
  //   (details, callback) => {
  //     if (
  //       details.url.includes("youtube.com") ||
  //       details.url.includes("googlevideo.com")
  //     ) {
  //       details.requestHeaders["Referer"] = "https://www.youtube.com/";
  //     }
  //     callback({ requestHeaders: details.requestHeaders });
  //   }
  // );

  if (isDevelopment) {
    try {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (error) {
      logger.warn({ error }, "Failed to open devtools");
    }
  }
}
function registerCoreIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, targetUrl) => {
    await shell.openExternal(targetUrl);
  });
  ipcMain.handle(IPC_CHANNELS.QUIT, () => {
    app.quit();
  });
}

// クリーンアップ関数
function cleanup() {
  logger.info("Cleaning up resources...");

  // Reactサーバーは使用しないため、クリーンアップ不要

  if (liveMonitor) {
    liveMonitor.stop();
    liveMonitor = null;
  }

  if (database) {
    database.close();
    database = null;
  }

  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }

  logger.info("Cleanup completed");
}

// シグナルハンドリング
function setupSignalHandlers() {
  // SIGINT (Ctrl+C)
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    cleanup();
    process.exit(0);
  });

  // SIGTERM
  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    cleanup();
    process.exit(0);
  });

  // 未処理の例外
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    logger.fatal({ error, stack: error.stack }, "Uncaught exception");
    cleanup();
    process.exit(1);
  });

  // 未処理のPromise拒否
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    logger.fatal({ reason, promise }, "Unhandled promise rejection");
    cleanup();
    process.exit(1);
  });
}
async function initializeApp() {
  try {
    // シグナルハンドラーを最初に設定
    setupSignalHandlers();

    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }

    app.on("second-instance", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });

    app.on("before-quit", () => {
      cleanup();
    });

    await app.whenReady();
    database = await StageDockDatabase.create();
    notificationService = new NotificationService();
    liveMonitor = new LiveMonitor(database, notificationService);
    liveMonitor.start();
    registerIpcHandlers(database);
    registerCoreIpcHandlers();
    await createWindow();

    if (!isDevelopment) {
      try {
        await autoUpdater.checkForUpdatesAndNotify();
      } catch (error) {
        logger.warn({ error }, "Auto update check failed");
      }
    }
  } catch (error) {
    logger.fatal(
      { error, stack: error instanceof Error ? error.stack : undefined },
      "Failed to initialize app"
    );
    cleanup();
    app.exit(1);
  }
}
initializeApp().catch((error) => {
  logger.fatal(
    { error, stack: error instanceof Error ? error.stack : undefined },
    "Failed to bootstrap application"
  );
  cleanup();
  app.exit(1);
});
