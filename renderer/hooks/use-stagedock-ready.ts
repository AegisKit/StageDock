"use client";

import { useEffect, useState } from "react";
import { isStageDockAvailable } from "../lib/stagedock";

export function useStageDockReady(): boolean {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    // 開発環境では常にtrueを返す（Electronのpreloadスクリプトが利用できない場合）
    const isDevelopment =
      typeof window !== "undefined" &&
      (window.location.href.includes("localhost:3000") ||
        window.location.href.includes("127.0.0.1:3000"));

    if (isDevelopment) {
      console.log(
        "Development environment detected, bypassing StageDock API check"
      );
      setReady(true);
      return;
    }

    // 即座にチェック
    if (isStageDockAvailable()) {
      setReady(true);
      return;
    }

    // 定期的にチェック（より頻繁に）
    const checkInterval = setInterval(() => {
      if (isStageDockAvailable()) {
        setReady(true);
        clearInterval(checkInterval);
      }
    }, 100);

    // イベントリスナーも設定
    const handleReadyEvent = () => {
      setReady(true);
      clearInterval(checkInterval);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("stagedock:ready", handleReadyEvent, {
        once: true,
      });
    }

    // フォールバックタイマー（1秒後にタイムアウト）
    const fallbackId = setTimeout(() => {
      console.warn(
        "StageDock API not available after 1 second, proceeding anyway"
      );
      setReady(true);
      clearInterval(checkInterval);
    }, 1000);

    return () => {
      clearTimeout(fallbackId);
      clearInterval(checkInterval);
      if (typeof window !== "undefined") {
        window.removeEventListener("stagedock:ready", handleReadyEvent);
      }
    };
  }, []); // 依存配列を空にして、一度だけ実行

  return ready;
}
