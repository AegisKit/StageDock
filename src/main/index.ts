import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type {
  OnBeforeSendHeadersListenerDetails,
  Session,
} from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

// ネイティブモジュールの初期化
try {
  // better-sqlite3の初期化
  require("better-sqlite3");
  logger.info("better-sqlite3 initialized successfully");
} catch (error) {
  logger.error({ error }, "Failed to initialize better-sqlite3");
}

try {
  // keytarの初期化
  require("keytar");
  logger.info("keytar initialized successfully");
} catch (error) {
  logger.error({ error }, "Failed to initialize keytar");
}

// デバッグ用のログファイルを作成
const debugLogPath = path.join(process.cwd(), "debug.log");
const logToFile = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    writeFileSync(debugLogPath, logMessage, { flag: "a" });
  } catch (error) {
    console.error("Failed to write debug log:", error);
  }
};

// グローバル変数でリソースを管理
let database: StageDockDatabase | null = null;
let liveMonitor: LiveMonitor | null = null;
let notificationService: NotificationService | null = null;
let multiviewWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

// アップデート進捗をレンダラープロセスに送信
function sendUpdateProgress(progress: {
  percent: number;
  transferred: number;
  total: number;
}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.UPDATE_PROGRESS, progress);
  }
}

// アップデートステータスをレンダラープロセスに送信
function sendUpdateStatus(status: { isUpdating: boolean; message: string }) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.UPDATE_STATUS, status);
  }
}

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

const STREAMING_URL_FILTERS = [
  "*://*.youtube.com/*",
  "*://youtube.com/*",
  "*://*.youtube-nocookie.com/*",
  "*://youtube-nocookie.com/*",
  "*://youtu.be/*",
  "*://*.googlevideo.com/*",
  "*://*.ytimg.com/*",
  "*://*.ggpht.com/*",
  "*://*.youtube.googleapis.com/*",
  "*://*.youtubei.googleapis.com/*",
  "*://*.x.com/*",
  "*://x.com/*",
  "*://*.twitter.com/*",
  "*://twitter.com/*",
  "*://*.twimg.com/*",
] as const;

type StreamingPolicy = {
  referrer: string;
  origin: string;
  allowedDomains: ReadonlyArray<string>;
};

const YOUTUBE_POLICY: StreamingPolicy = {
  referrer: "https://www.youtube.com/",
  origin: "https://www.youtube.com",
  allowedDomains: ["youtube.com"],
};

const YOUTUBE_NOCOOKIE_POLICY: StreamingPolicy = {
  referrer: "https://www.youtube-nocookie.com/",
  origin: "https://www.youtube-nocookie.com",
  allowedDomains: ["youtube-nocookie.com", "youtube.com"],
};

const X_POLICY: StreamingPolicy = {
  referrer: "https://x.com/",
  origin: "https://x.com",
  allowedDomains: ["x.com", "twitter.com"],
};

const patchedSessions = new WeakSet<Session>();

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = headers[key];
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function resolveStreamingPolicy(
  details: OnBeforeSendHeadersListenerDetails
): StreamingPolicy | null {
  let hostname: string;
  try {
    hostname = new URL(details.url).hostname.toLowerCase();
  } catch {
    return null;
  }

  const currentReferrer =
    details.referrer ??
    getHeaderValue(details.requestHeaders, "Referer") ??
    undefined;
  const preferNoCookie =
    currentReferrer?.toLowerCase().includes("youtube-nocookie.com") ?? false;

  if (matchesDomain(hostname, "youtube-nocookie.com")) {
    return YOUTUBE_NOCOOKIE_POLICY;
  }

  if (matchesDomain(hostname, "youtube.com") || hostname === "youtu.be") {
    return YOUTUBE_POLICY;
  }

  if (
    matchesDomain(hostname, "googlevideo.com") ||
    matchesDomain(hostname, "ytimg.com") ||
    matchesDomain(hostname, "ggpht.com") ||
    matchesDomain(hostname, "youtube.googleapis.com") ||
    matchesDomain(hostname, "youtubei.googleapis.com")
  ) {
    if (preferNoCookie) {
      return YOUTUBE_NOCOOKIE_POLICY;
    }
    return {
      referrer: YOUTUBE_POLICY.referrer,
      origin: YOUTUBE_POLICY.origin,
      allowedDomains: Array.from(
        new Set([
          ...YOUTUBE_POLICY.allowedDomains,
          ...YOUTUBE_NOCOOKIE_POLICY.allowedDomains,
        ])
      ),
    };
  }

  if (
    matchesDomain(hostname, "x.com") ||
    matchesDomain(hostname, "twitter.com") ||
    matchesDomain(hostname, "twimg.com")
  ) {
    return X_POLICY;
  }

  return null;
}

function ensureStreamingRequestHeaders(session: Session) {
  if (patchedSessions.has(session)) {
    return;
  }

  patchedSessions.add(session);

  session.webRequest.onBeforeSendHeaders(
    { urls: [...STREAMING_URL_FILTERS] },
    (details, callback) => {
      const policy = resolveStreamingPolicy(details);
      if (!policy) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }

      const currentReferrer =
        details.referrer ??
        getHeaderValue(details.requestHeaders, "Referer") ??
        undefined;

      if (currentReferrer) {
        try {
          const refHost = new URL(currentReferrer).hostname.toLowerCase();
          const allowed = policy.allowedDomains.some((domain) =>
            matchesDomain(refHost, domain)
          );
          if (allowed) {
            callback({ requestHeaders: details.requestHeaders });
            return;
          }
        } catch {
          // ignore invalid referrer and overwrite below
        }
      }

      const requestHeaders = { ...details.requestHeaders };
      requestHeaders.Referer = policy.referrer;
      requestHeaders.Origin = policy.origin;
      callback({ requestHeaders });
    }
  );
}

const isDevelopment = !app.isPackaged;
// CommonJSでは__filenameと__dirnameは自動的に利用可能
function resolvePreloadPath() {
  return path.join(__dirname, "../../preload/preload/index.cjs");
}

// Reactサーバーは不要 - 静的ファイルを直接読み込み

function resolveMultiviewUrl() {
  if (isDevelopment) {
    // 開発環境ではReact開発サーバーを使用
    return `http://localhost:3000/#/multiview-window`;
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
    icon: path.join(__dirname, "../../assets/icons/icon-256x256.png"), // アイコンを設定
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

  ensureStreamingRequestHeaders(multiviewWindow.webContents.session);

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
  console.log("Creating main window...");
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
    icon: path.join(__dirname, "../../assets/icons/icon-256x256.png"), // アイコンを設定
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

  ensureStreamingRequestHeaders(mainWindow.webContents.session);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    // アプリ起動時に最大化ウィンドウで起動
    mainWindow?.maximize();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const loadURL = async () => {
    if (!mainWindow) return;

    try {
      if (isDevelopment) {
        // 開発環境ではReact開発サーバーを使用
        console.log("Loading development React server...");
        logger.info("Loading development React server");
        await mainWindow.loadURL("http://localhost:3000");
      } else {
        // 本番環境では静的ファイルを直接読み込み
        console.log("Loading React static files for production...");
        logger.info("Loading React static files for production");
        const indexPath = path.join(
          app.getAppPath(),
          "dist",
          "renderer",
          "index.html"
        );
        console.log("Looking for renderer at:", indexPath);
        if (existsSync(indexPath)) {
          console.log("Renderer file found, loading...");
          logger.info({ indexPath }, "Loading renderer from static file");
          await mainWindow.loadURL(`file://${indexPath}`);
        } else {
          console.error("Renderer file not found at:", indexPath);
          throw new Error("No renderer files found");
        }
      }
    } catch (error) {
      console.error("Failed to load renderer:", error);
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
function setupAutoUpdater() {
  // プライベートリポジトリ用のカスタムアップデートチェック
  checkForUpdatesCustom();

  // アップデートが利用可能になったとき
  autoUpdater.on("update-available", (info) => {
    logger.info({ version: info.version }, "Update available");

    if (notificationService) {
      notificationService.showUpdateNotification({
        version: info.version,
        releaseNotes: info.releaseNotes ? String(info.releaseNotes) : undefined,
        onDownload: () => {
          logger.info("User requested update download");
          sendUpdateStatus({
            isUpdating: true,
            message: "アップデートをダウンロード中...",
          });
          autoUpdater.downloadUpdate();
        },
      });
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    logger.info({ version: info.version }, "Update downloaded");

    // ネイティブモジュールの再ビルドを試行
    try {
      logger.info("Attempting to rebuild native modules after update");
      // ここでネイティブモジュールの再ビルドを実行
      // 実際の再ビルドは次回起動時にpostinstallスクリプトで実行される
    } catch (error) {
      logger.error({ error }, "Failed to rebuild native modules");
    }

    sendUpdateStatus({
      isUpdating: true,
      message: "アップデートの準備が完了しました。再起動します...",
    });

    // 3秒後に自動で再起動
    setTimeout(() => {
      logger.info("Auto-restarting after update");
      autoUpdater.quitAndInstall();
    }, 3000);
  });

  autoUpdater.on("error", (error) => {
    logger.error({ error }, "Auto updater error");
  });

  // ダウンロード進行状況
  autoUpdater.on("download-progress", (progressObj) => {
    logger.debug(
      {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      },
      "Download progress"
    );

    // 進捗をレンダラープロセスに送信
    sendUpdateProgress({
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });
}

// プライベートリポジトリ用のカスタムアップデートチェック
async function checkForUpdatesCustom() {
  try {
    // GitHub APIを使用してリリース情報を取得
    const githubToken =
      ; // 実際のトークンに置き換えてください
    const response = await fetch(
      "https://api.github.com/repos/AegisKit/StageDock/releases/latest",
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn(
          "GitHub API authentication failed, falling back to standard updater"
        );
        // 認証エラーの場合は標準のelectron-updaterを使用
        autoUpdater.checkForUpdates();
        return;
      }
      logger.warn({ status: response.status }, "Failed to fetch release info");
      return;
    }

    const release = await response.json();
    const latestVersion = release.tag_name.replace("v", "");
    const currentVersion = app.getVersion();

    logger.info({ currentVersion, latestVersion }, "Version comparison");

    if (latestVersion !== currentVersion) {
      logger.info("Update available via custom check");
      // アップデート通知を表示
      if (notificationService) {
        notificationService.showUpdateNotification({
          version: latestVersion,
          releaseNotes: release.body,
          onDownload: () => {
            logger.info("User requested update download");
            // リリースページを開く
            shell.openExternal(release.html_url);
          },
        });
      }
    }
  } catch (error) {
    logger.error(
      { error },
      "Custom update check failed, falling back to standard updater"
    );
    // エラーの場合は標準のelectron-updaterを使用
    autoUpdater.checkForUpdates();
  }
}

function registerCoreIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, targetUrl) => {
    await shell.openExternal(targetUrl);
  });
  ipcMain.handle(IPC_CHANNELS.QUIT, () => {
    app.quit();
  });
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return app.getVersion();
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    if (isDevelopment) {
      throw new Error("Update check is not available in development mode");
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      // シリアライズ可能なオブジェクトのみを返す
      return {
        updateInfo: result?.updateInfo
          ? {
              version: result.updateInfo.version,
              releaseDate: result.updateInfo.releaseDate,
              releaseName: result.updateInfo.releaseName,
              releaseNotes: result.updateInfo.releaseNotes,
            }
          : null,
        downloadPromise: result?.downloadPromise ? true : false,
        cancellationToken: result?.cancellationToken ? true : false,
      };
    } catch (error) {
      logger.error({ error }, "Manual update check failed");
      throw error;
    }
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    if (isDevelopment) {
      throw new Error("Update download is not available in development mode");
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      logger.error({ error }, "Manual update download failed");
      throw error;
    }
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    if (isDevelopment) {
      throw new Error("Update install is not available in development mode");
    }
    autoUpdater.quitAndInstall();
    return { success: true };
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
  logToFile("Starting StageDock initialization...");
  console.log("Starting StageDock initialization...");
  try {
    // シグナルハンドラーを最初に設定
    logToFile("Setting up signal handlers...");
    setupSignalHandlers();

    if (!app.requestSingleInstanceLock()) {
      logToFile("Single instance lock failed, quitting...");
      app.quit();
      return;
    }

    logToFile("Setting up app event handlers...");
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

    logToFile("Waiting for app to be ready...");
    await app.whenReady();
    // Ensure Windows notifications use our app identity instead of Electron
    try {
      app.setAppUserModelId("StageDock");
      logToFile("AppUserModelID set to com.stagedock.app");
    } catch (error) {
      logger.warn({ error }, "Failed to set AppUserModelID");
    }
    logToFile("App is ready, initializing database...");
    console.log("App is ready, initializing database...");
    database = await StageDockDatabase.create();
    logToFile("Database initialized, creating services...");
    console.log("Database initialized, creating services...");
    notificationService = new NotificationService();
    liveMonitor = new LiveMonitor(database, notificationService);
    liveMonitor.start();
    logToFile("Services started, registering IPC handlers...");
    console.log("Services started, registering IPC handlers...");
    registerIpcHandlers(database);
    registerCoreIpcHandlers();
    logToFile("IPC handlers registered, creating window...");
    console.log("IPC handlers registered, creating window...");
    await createWindow();
    logToFile("Window created successfully");
    console.log("Window created successfully");

    if (!isDevelopment) {
      setupAutoUpdater();
    }
  } catch (error) {
    logToFile(`FATAL ERROR during initialization: ${error}`);
    console.error("FATAL ERROR during initialization:", error);
    logger.fatal(
      { error, stack: error instanceof Error ? error.stack : undefined },
      "Failed to initialize app"
    );
    cleanup();
    app.exit(1);
  }
}

initializeApp().catch((error) => {
  logToFile(`BOOTSTRAP ERROR: ${error}`);
  console.error("BOOTSTRAP ERROR:", error);
  logger.fatal(
    { error, stack: error instanceof Error ? error.stack : undefined },
    "Failed to bootstrap application"
  );
  cleanup();
  app.exit(1);
});
