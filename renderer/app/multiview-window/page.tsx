"use client";

import { useEffect, useState, useRef } from "react";

interface MultiviewData {
  urls: string[];
  layout: string;
}

function convertToEmbedUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // YouTube
    if (
      urlObj.hostname.includes("youtube.com") ||
      urlObj.hostname.includes("youtu.be")
    ) {
      let videoId = "";
      if (urlObj.hostname.includes("youtu.be")) {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.hostname.includes("youtube.com")) {
        videoId = urlObj.searchParams.get("v") || "";
      }
      if (videoId) {
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const params = new URLSearchParams({
          enablejsapi: "1",
          origin: window.location.origin,
          rel: "0",
          modestbranding: "1",
          fs: "1",
          autoplay: "0",
        });
        return `${embedUrl}?${params.toString()}`;
      }
    }

    // Twitch
    if (urlObj.hostname.includes("twitch.tv")) {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const channel = pathParts[0];
        return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
      }
    }

    return url;
  } catch (error) {
    console.error("Error converting URL to embed:", error);
    return url;
  }
}

export default function MultiviewWindowPage() {
  const [data, setData] = useState<MultiviewData | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [streamSizes, setStreamSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // メインプロセスからデータを受信
    const handleMultiviewData = (event: CustomEvent<MultiviewData>) => {
      setData(event.detail);
    };

    // カスタムイベントリスナーを追加
    document.addEventListener(
      "multiview:data",
      handleMultiviewData as EventListener
    );

    // IPC通信でデータを受信
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onMultiviewData((data: MultiviewData) => {
        setData(data);
      });
    }

    // フルスクリーン状態の監視
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // キーボードショートカット
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          // フルスクリーン中の場合はフルスクリーンを終了
          e.preventDefault();
          toggleFullscreen();
        } else {
          // 通常時はウィンドウを閉じる
          if ((window as any).stagedock) {
            (window as any).stagedock.multiview.close();
          } else {
            window.close();
          }
        }
      } else if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "multiview:data",
        handleMultiviewData as EventListener
      );
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isFullscreen]);

  // データが読み込まれた時に初期サイズを設定
  useEffect(() => {
    if (data && containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const { urls } = data;

      // 初期サイズを計算（すべて同じサイズでウィンドウいっぱいに表示）
      const initialSizes: Record<string, { width: number; height: number }> =
        {};
      const cols = Math.ceil(Math.sqrt(urls.length));
      const rows = Math.ceil(urls.length / cols);
      const cellWidth = containerRect.width / cols;
      const cellHeight = containerRect.height / rows;

      urls.forEach((url) => {
        initialSizes[url] = {
          width: cellWidth,
          height: cellHeight,
        };
      });

      setStreamSizes(initialSizes);
    }
  }, [data]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // 真のフルスクリーンモードを要求
        await document.documentElement.requestFullscreen({
          navigationUI: "hide", // ナビゲーションUIを非表示
        });
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();

    const currentSize = streamSizes[url] || { width: 400, height: 300 };
    setIsDragging(url);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      width: currentSize.width,
      height: currentSize.height,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !dragStart) return;

    // マウスの移動距離を計算
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // 新しいサイズを計算（最小サイズ制限なし、完全に自由）
    const newWidth = Math.max(50, dragStart.width + deltaX);
    const newHeight = Math.max(50, dragStart.height + deltaY);

    setStreamSizes((prev) => ({
      ...prev,
      [isDragging]: {
        width: newWidth,
        height: newHeight,
      },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setDragStart(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (!data) {
    return (
      <div className="multiview-loading">
        <div className="loading-content">
          <h2>Loading streams...</h2>
          <p>Waiting for stream data...</p>
        </div>
      </div>
    );
  }

  const { urls } = data;

  return (
    <div className={`multiview-container ${isFullscreen ? "fullscreen" : ""}`}>
      {/* フルスクリーン時のみ表示されるコントロール */}
      {isFullscreen && (
        <div className="fullscreen-controls">
          <div className="fullscreen-info">
            <span>フルスクリーンモード - ESCキーで終了</span>
          </div>
        </div>
      )}

      <div className="multiview-content" ref={containerRef}>
        <div className="streams-container">
          {urls.map((url, index) => {
            const embedUrl = convertToEmbedUrl(url);
            const size = streamSizes[url] || { width: 400, height: 300 };

            return (
              <div
                key={`stream-${index}`}
                className="stream-item"
                style={{
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                }}
              >
                <div className="stream-player">
                  <iframe
                    src={embedUrl}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title={url}
                    className="stream-iframe"
                  />
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(e) => handleMouseDown(e, url)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .multiview-loading {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #101014;
          color: #ffffff;
        }

        .loading-content {
          text-align: center;
        }

        .loading-content h2 {
          font-size: 24px;
          margin-bottom: 16px;
        }

        .loading-content p {
          font-size: 16px;
          color: #888888;
        }

        .multiview-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #101014;
          color: #ffffff;
          overflow: hidden;
          position: relative;
        }

        .multiview-content {
          flex: 1;
          padding: 0;
          overflow: hidden;
          position: relative;
          width: 100%;
          height: 100%;
        }

        .streams-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          align-content: flex-start;
          position: relative;
          overflow: auto;
        }

        /* フルスクリーン時の制約を修正 */
        .multiview-container:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
        }

        .multiview-container:fullscreen .multiview-content {
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
        }

        .multiview-container:fullscreen .streams-container {
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
        }

        .multiview-container:fullscreen .stream-item {
          position: relative;
        }

        /* フルスクリーン時のコントロール */
        .fullscreen-controls {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.8);
          padding: 8px 16px;
          color: #ffffff;
          font-size: 14px;
          text-align: center;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .multiview-container:hover .fullscreen-controls {
          opacity: 1;
        }

        .fullscreen-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        /* フルスクリーン時の追加スタイル */
        .multiview-container.fullscreen {
          background: #000000;
        }

        .multiview-container.fullscreen .streams-container {
          background: #000000;
        }

        .stream-player {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .stream-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: #000;
        }

        .resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 24px;
          height: 24px;
          background: linear-gradient(
            -45deg,
            transparent 30%,
            #4a4a4f 30%,
            #4a4a4f 40%,
            transparent 40%,
            transparent 60%,
            #4a4a4f 60%,
            #4a4a4f 70%,
            transparent 70%
          );
          cursor: nw-resize;
          opacity: 0.8;
          transition: all 0.2s;
          border-radius: 2px;
          z-index: 10;
        }

        .resize-handle:hover {
          opacity: 1;
          background: linear-gradient(
            -45deg,
            transparent 30%,
            #5a5a5f 30%,
            #5a5a5f 40%,
            transparent 40%,
            transparent 60%,
            #5a5a5f 60%,
            #5a5a5f 70%,
            transparent 70%
          );
          transform: scale(1.1);
        }

        .stream-item:hover .resize-handle {
          opacity: 1;
        }

        .stream-item {
          background: #1a1a1f;
          border: 1px solid #2a2a2f;
          overflow: hidden;
          position: relative;
          min-width: 50px;
          min-height: 50px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
