"use client";

import { useEffect } from "react";

export function GlobalEventHandler() {
  useEffect(() => {
    const handleAddToMultiview = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;

      if (detail?.url) {
        // セッションストレージにURLを保存
        const existingUrls = JSON.parse(
          sessionStorage.getItem("stagedock-pending-urls") || "[]"
        );
        if (!existingUrls.includes(detail.url)) {
          existingUrls.push(detail.url);
          sessionStorage.setItem(
            "stagedock-pending-urls",
            JSON.stringify(existingUrls)
          );
        }

        // multiviewページに通知
        document.dispatchEvent(
          new CustomEvent("stagedock:url-added", {
            detail: { url: detail.url },
          })
        );
      }
    };

    document.addEventListener(
      "stagedock:add-to-multiview",
      handleAddToMultiview as EventListener
    );

    return () => {
      document.removeEventListener(
        "stagedock:add-to-multiview",
        handleAddToMultiview as EventListener
      );
    };
  }, []);

  return null;
}
