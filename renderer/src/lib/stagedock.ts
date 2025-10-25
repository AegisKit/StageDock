import type { StageDockAPI } from "../../../src/common/api.js";

export function isStageDockAvailable(): boolean {
  const available = typeof window !== "undefined" && Boolean(window.stagedock);
  console.log("isStageDockAvailable:", available, {
    hasWindow: typeof window !== "undefined",
    hasStagedock: typeof window !== "undefined" && Boolean(window.stagedock),
    windowKeys: typeof window !== "undefined" ? Object.keys(window) : [],
  });
  return available;
}

export function getStageDock(): StageDockAPI {
  if (!isStageDockAvailable()) {
    throw new Error("StageDock API is not available in this context.");
  }

  return window.stagedock;
}
