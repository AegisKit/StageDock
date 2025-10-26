"use client";

import type { StageDockAPI } from "../../src/common/api.js";

export function isStageDockAvailable(): boolean {
  const available = typeof window !== "undefined" && Boolean(window.stagedock);
  console.log("isStageDockAvailable:", available, {
    hasWindow: typeof window !== "undefined",
    hasStagedock: typeof window !== "undefined" && Boolean(window.stagedock),
    windowKeys: typeof window !== "undefined" ? Object.keys(window) : [],
    userAgent:
      typeof window !== "undefined" ? window.navigator.userAgent : "no window",
    location:
      typeof window !== "undefined" ? window.location.href : "no window",
  });
  return available;
}

export function getStageDock(): StageDockAPI {
  if (!isStageDockAvailable()) {
    // 開発環境ではモックAPIを提供
    const isDevelopment =
      typeof window !== "undefined" &&
      (window.location.href.includes("localhost:3000") ||
        window.location.href.includes("127.0.0.1:3000"));

    if (isDevelopment) {
      console.log("Development environment: Using mock StageDock API");
      return {
        openExternal: async (url: string) => {
          console.log("Mock openExternal:", url);
          window.open(url, "_blank");
        },
        quit: async () => {
          console.log("Mock quit");
        },
        creators: {
          list: async () => {
            console.log("Mock creators.list");
            return [];
          },
          create: async (payload: any) => {
            console.log("Mock creators.create:", payload);
            return { id: "mock", ...payload };
          },
          update: async (payload: any) => {
            console.log("Mock creators.update:", payload);
            return { id: "mock", ...payload };
          },
          delete: async (id: string) => {
            console.log("Mock creators.delete:", id);
            return { success: true };
          },
          refreshStatus: async (id: string) => {
            console.log("Mock creators.refreshStatus:", id);
            return null;
          },
        },
        liveStatus: {
          list: async () => {
            console.log("Mock liveStatus.list");
            return [];
          },
        },
        urlSets: {
          list: async () => {
            console.log("Mock urlSets.list");
            return [];
          },
          save: async (payload: any) => {
            console.log("Mock urlSets.save:", payload);
            return { id: "mock", ...payload };
          },
          delete: async (id: string) => {
            console.log("Mock urlSets.delete:", id);
            return { success: true };
          },
          touch: async (id: string) => {
            console.log("Mock urlSets.touch:", id);
            return { id: "mock", name: "Mock URL Set" };
          },
        },
        settings: {
          get: async (key: string) => {
            console.log("Mock settings.get:", key);
            // localStorageから設定を取得
            const stored = localStorage.getItem(`stagedock_setting_${key}`);
            return stored ? JSON.parse(stored) : undefined;
          },
          set: async (key: string, value: any) => {
            console.log("Mock settings.set:", key, value);
            // localStorageに設定を保存
            localStorage.setItem(
              `stagedock_setting_${key}`,
              JSON.stringify(value)
            );
            return { key, value };
          },
        },
        multiview: {
          open: async (urls: string[], layout: string) => {
            console.log("Mock multiview.open:", urls, layout);
          },
          close: async () => {
            console.log("Mock multiview.close");
          },
        },
      };
    }

    throw new Error("StageDock API is not available in this context.");
  }

  return window.stagedock;
}
