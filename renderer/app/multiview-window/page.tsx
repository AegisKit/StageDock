"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MultiviewData {
  urls: string[];
  layout: string;
}

function convertToEmbedUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    if (
      urlObj.hostname.includes("youtube.com") ||
      urlObj.hostname.includes("youtu.be")
    ) {
      let videoId = "";
      if (urlObj.hostname.includes("youtu.be")) {
        videoId = urlObj.pathname.slice(1);
      } else {
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

type StreamSize = { width: number; height: number };
type StreamPosition = { left: number; top: number };
type PointerState = { mode: "resize" | "move"; url: string };
type ResizeStart = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  containerWidth: number;
  containerHeight: number;
};
type MoveStart = {
  offsetX: number;
  offsetY: number;
  containerWidth: number;
  containerHeight: number;
};

const MIN_WIDTH = 160;
const MIN_HEIGHT = 140;
const HEADER_HEIGHT = 32;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function getDisplayName(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (error) {
    return fallback;
  }
}

export default function MultiviewWindowPage() {
  const [data, setData] = useState<MultiviewData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamSizes, setStreamSizes] = useState<Record<string, StreamSize>>(
    {}
  );
  const [streamPositions, setStreamPositions] = useState<
    Record<string, StreamPosition>
  >({});
  const [pointerState, setPointerState] = useState<PointerState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const streamSizesRef = useRef(streamSizes);
  const pointerStateRef = useRef<PointerState | null>(null);
  const resizeStartRef = useRef<ResizeStart | null>(null);
  const moveStartRef = useRef<MoveStart | null>(null);

  useEffect(() => {
    streamSizesRef.current = streamSizes;
  }, [streamSizes]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  }, []);

  useEffect(() => {
    const handleMultiviewData = (event: Event) => {
      const detail = (event as CustomEvent<MultiviewData>).detail;
      setData(detail);
    };

    document.addEventListener(
      "multiview:data",
      handleMultiviewData as EventListener
    );

    if ((window as any).electronAPI) {
      (window as any).electronAPI.onMultiviewData((payload: MultiviewData) => {
        setData(payload);
      });
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          toggleFullscreen();
        } else {
          if ((window as any).stagedock) {
            (window as any).stagedock.multiview.close();
          } else {
            window.close();
          }
        }
      } else if (event.key === "F11") {
        event.preventDefault();
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
  }, [toggleFullscreen]);

  useEffect(() => {
    if (!data || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const { urls } = data;

    if (!urls.length) {
      setStreamSizes({});
      setStreamPositions({});
      return;
    }

    const cols = Math.ceil(Math.sqrt(urls.length));
    const rows = Math.ceil(urls.length / cols);

    const defaultWidth = Math.max(
      MIN_WIDTH,
      Math.min(rect.width / cols, rect.width)
    );
    const defaultHeight = Math.max(
      MIN_HEIGHT,
      Math.min(rect.height / rows, rect.height)
    );

    setStreamSizes((prev) => {
      const next: Record<string, StreamSize> = { ...prev };
      let changed = false;

      urls.forEach((url) => {
        if (!next[url]) {
          next[url] = { width: defaultWidth, height: defaultHeight };
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!urls.includes(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setStreamPositions((prev) => {
      const next: Record<string, StreamPosition> = { ...prev };
      let changed = false;

      urls.forEach((url, index) => {
        if (!next[url]) {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const left = col * defaultWidth;
          const top = row * defaultHeight;

          next[url] = {
            left: clamp(left, 0, Math.max(0, rect.width - defaultWidth)),
            top: clamp(top, 0, Math.max(0, rect.height - defaultHeight)),
          };
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!urls.includes(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [data]);

  const finishPointer = useCallback(() => {
    pointerStateRef.current = null;
    resizeStartRef.current = null;
    moveStartRef.current = null;
    setPointerState(null);
  }, []);

  const handlePointerMove = useCallback(
    (event: MouseEvent) => {
      const pointer = pointerStateRef.current;
      if (!pointer) {
        return;
      }

      if (event.buttons === 0) {
        finishPointer();
        return;
      }

      if (pointer.mode === "resize") {
        const start = resizeStartRef.current;
        if (!start) {
          return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;

        const maxWidth = Math.max(
          MIN_WIDTH,
          start.containerWidth - start.left
        );
        const maxHeight = Math.max(
          MIN_HEIGHT,
          start.containerHeight - start.top
        );

        const nextWidth = clamp(start.width + deltaX, MIN_WIDTH, maxWidth);
        const nextHeight = clamp(start.height + deltaY, MIN_HEIGHT, maxHeight);

        setStreamSizes((prev) => {
          const current = prev[pointer.url];
          if (
            current &&
            current.width === nextWidth &&
            current.height === nextHeight
          ) {
            return prev;
          }

          return {
            ...prev,
            [pointer.url]: {
              width: nextWidth,
              height: nextHeight,
            },
          };
        });

        return;
      }

      const start = moveStartRef.current;
      if (!start) {
        return;
      }

      const size =
        streamSizesRef.current[pointer.url] || {
          width: MIN_WIDTH,
          height: MIN_HEIGHT,
        };

      const maxLeft = Math.max(0, start.containerWidth - size.width);
      const maxTop = Math.max(0, start.containerHeight - size.height);

      const nextLeft = clamp(event.clientX - start.offsetX, 0, maxLeft);
      const nextTop = clamp(event.clientY - start.offsetY, 0, maxTop);

      setStreamPositions((prev) => {
        const current = prev[pointer.url];
        if (current && current.left === nextLeft && current.top === nextTop) {
          return prev;
        }

        return {
          ...prev,
          [pointer.url]: {
            left: nextLeft,
            top: nextTop,
          },
        };
      });
    },
    [finishPointer]
  );

  const handlePointerUp = useCallback(() => {
    finishPointer();
  }, [finishPointer]);

  useEffect(() => {
    if (!pointerState) {
      return;
    }

    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);

    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
    };
  }, [pointerState, handlePointerMove, handlePointerUp]);

  const startResize = (event: React.MouseEvent, url: string) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const size =
      streamSizesRef.current[url] || { width: MIN_WIDTH, height: MIN_HEIGHT };
    const position = streamPositions[url] || { left: 0, top: 0 };
    const containerRect = containerRef.current?.getBoundingClientRect();

    const nextPointer: PointerState = { mode: "resize", url };
    pointerStateRef.current = nextPointer;
    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
      left: position.left,
      top: position.top,
      containerWidth: containerRect?.width ?? window.innerWidth,
      containerHeight: containerRect?.height ?? window.innerHeight,
    };
    setPointerState(nextPointer);
  };

  const startMove = (event: React.MouseEvent, url: string) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const position = streamPositions[url] || { left: 0, top: 0 };
    const containerRect = containerRef.current?.getBoundingClientRect();

    const nextPointer: PointerState = { mode: "move", url };
    pointerStateRef.current = nextPointer;
    moveStartRef.current = {
      offsetX: event.clientX - position.left,
      offsetY: event.clientY - position.top,
      containerWidth: containerRect?.width ?? window.innerWidth,
      containerHeight: containerRect?.height ?? window.innerHeight,
    };
    setPointerState(nextPointer);
  };

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
  const pointerLocked = Boolean(pointerState);

  return (
    <div
      className={`multiview-container ${isFullscreen ? "fullscreen" : ""} ${
        pointerLocked ? "pointer-locked" : ""
      }`}
    >
      {isFullscreen && (
        <div className="fullscreen-controls">
          <div className="fullscreen-info">
            <span>Fullscreen mode - press ESC to exit</span>
          </div>
        </div>
      )}

      <div className="multiview-content" ref={containerRef}>
        <div className="streams-container">
          {urls.map((url, index) => {
            const size =
              streamSizes[url] || { width: MIN_WIDTH, height: MIN_HEIGHT };
            const position = streamPositions[url] || { left: 0, top: 0 };
            const displayName = getDisplayName(url, `Stream ${index + 1}`);
            const isActive = pointerState?.url === url;

            return (
              <div
                key={`${url}-${index}`}
                className={`stream-item ${isActive ? "active" : ""}`}
                style={{
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                  left: `${position.left}px`,
                  top: `${position.top}px`,
                }}
              >
                <div
                  className="stream-header"
                  onMouseDown={(event) => startMove(event, url)}
                >
                  <span className="stream-title">{displayName}</span>
                </div>
                <div className="stream-player">
                  <iframe
                    src={convertToEmbedUrl(url)}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title={url}
                    className="stream-iframe"
                  />
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(event) => startResize(event, url)}
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
          position: relative;
          overflow: auto;
          padding: 8px;
          box-sizing: border-box;
        }

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

        .multiview-container.fullscreen {
          background: #000000;
        }

        .multiview-container.fullscreen .streams-container {
          background: #000000;
        }

        .multiview-container.pointer-locked .stream-iframe {
          pointer-events: none;
        }

        .stream-item {
          position: absolute;
          display: flex;
          flex-direction: column;
          background: #1a1a1f;
          border: 1px solid #2a2a2f;
          border-radius: 6px;
          overflow: hidden;
          min-width: ${MIN_WIDTH}px;
          min-height: ${MIN_HEIGHT}px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
          transition: box-shadow 0.2s ease;
        }

        .stream-item.active {
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.5);
        }

        .stream-header {
          flex: 0 0 ${HEADER_HEIGHT}px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          background: rgba(16, 16, 24, 0.8);
          backdrop-filter: blur(6px);
          font-size: 12px;
          letter-spacing: 0.4px;
          cursor: move;
          user-select: none;
        }

        .stream-header:hover {
          background: rgba(24, 24, 32, 0.9);
        }

        .stream-title {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .stream-player {
          position: relative;
          flex: 1;
          background: #000000;
        }

        .stream-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: #000000;
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
          transform: scale(1.08);
        }

        .stream-item:hover .resize-handle {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
