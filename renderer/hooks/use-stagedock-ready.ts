"use client";

import { useEffect, useState } from "react";
import { isStageDockAvailable } from "../lib/stagedock";

export function useStageDockReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => isStageDockAvailable());

  useEffect(() => {
    // 既にreadyの場合は何もしない
    if (ready) {
      return;
    }

    const handleReadyEvent = () => {
      setReady(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("stagedock:ready", handleReadyEvent, {
        once: true,
      });
    }

    // フォールバックタイマー（2秒後にタイムアウト）
    const fallbackId = setTimeout(() => {
      if (!isStageDockAvailable()) {
        console.warn("StageDock API not available after 2 seconds");
        // タイムアウト時もreadyをtrueにして、アプリが動作するようにする
        setReady(true);
      }
    }, 2000);

    return () => {
      clearTimeout(fallbackId);
      if (typeof window !== "undefined") {
        window.removeEventListener("stagedock:ready", handleReadyEvent);
      }
    };
  }, [ready]); // readyを依存配列に戻すが、readyがtrueの時は早期リターンする

  return ready;
}
