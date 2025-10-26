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

export const logger = pino({
  name: "StageDock",
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        }
      : {
          target: "pino/file",
          options: {
            destination: logFile,
            mkdir: true,
          },
        },
});
