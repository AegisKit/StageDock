import { pino } from "pino";
import { app } from "electron";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// ログディレクトリを確保
const logDir = path.join(app.getPath("userData"), "logs");
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "stagedock.log");

// ログファイルの場所をコンソールに出力（開発環境用）
console.log(`Log file location: ${logFile}`);

export const logger = pino({
  name: "StageDock",
  level: process.env.LOG_LEVEL ?? "info",
  transport: {
    target: "pino/file",
    options: {
      destination: logFile,
      mkdir: true,
    },
  },
});
