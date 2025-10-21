"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStageDock } from "../../lib/stagedock";

function normalizeUrls(input: string) {
  return input
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);
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
      } else if (urlObj.hostname.includes("youtube.com")) {
        videoId = urlObj.searchParams.get("v") || "";
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
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

export default function MultiViewPage() {
  const [urlsInput, setUrlsInput] = useState("");
  const [streams, setStreams] = useState<string[]>([]);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  const parsedUrls = useMemo(() => normalizeUrls(urlsInput), [urlsInput]);

  const handleApply = useCallback(() => {
    const urls = normalizeUrls(urlsInput);
    setStreams(urls);
    setActiveStream(urls[0] ?? null);
  }, [urlsInput]);

  const handleRemoveStream = useCallback((target: string) => {
    setStreams((prev) => prev.filter((url) => url !== target));
    setActiveStream((current) => (current === target ? null : current));
  }, []);

  const handleAddStream = useCallback(
    (url: string) => {
      setStreams((prev) => {
        if (prev.includes(url)) {
          return prev;
        }
        const next = [...prev, url];
        if (!activeStream) {
          setActiveStream(url);
        }
        return next;
      });
      setUrlsInput((prev) => (prev ? `${prev}\n${url}` : url));
    },
    [activeStream]
  );

  const openMultiviewWindow = useCallback(async () => {
    if (streams.length === 0) {
      return;
    }

    try {
      await getStageDock().multiview.open(streams, "2x2");
    } catch (error) {
      console.error("Failed to open multiview window:", error);
    }
  }, [streams]);

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent("stagedock:multiview-streams", {
        detail: { urls: streams },
      })
    );
  }, [streams]);

  useEffect(() => {
    const pendingUrls = JSON.parse(
      sessionStorage.getItem("stagedock-pending-urls") || "[]"
    );
    if (pendingUrls.length > 0) {
      pendingUrls.forEach((url: string) => {
        handleAddStream(url);
      });
      sessionStorage.removeItem("stagedock-pending-urls");
    }
  }, [handleAddStream]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (detail?.url) {
        handleAddStream(detail.url);
      }
    };

    document.addEventListener("stagedock:url-added", handler as EventListener);
    return () => {
      document.removeEventListener(
        "stagedock:url-added",
        handler as EventListener
      );
    };
  }, [handleAddStream]);

  return (
    <div className="section">
      <div className="section-heading">
        <h1 className="section-title">Multi-view</h1>
        <p className="section-description">
          Paste one URL per line and StageDock will build a tailored multi-view window for you.
        </p>
      </div>

      <div className="panel">
        <textarea
          value={urlsInput}
          onChange={(event) => setUrlsInput(event.target.value)}
          rows={4}
          className="textarea"
          placeholder="https://www.youtube.com/watch?v=...\nhttps://www.twitch.tv/..."
        />
        <div className="form-actions">
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              className="button button-primary"
              onClick={handleApply}
            >
              Update Preview
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={openMultiviewWindow}
              disabled={streams.length === 0}
              style={{ backgroundColor: "#4CAF50" }}
            >
              Open Multi-view Window
            </button>
          </div>
          <span className="misc-note">{parsedUrls.length} urls</span>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title-small">Preview</h2>
        {streams.length === 0 ? (
          <div className="empty-state">
            Add URLs and click "Update Preview" to see players here.
          </div>
        ) : (
          <div className="preview-grid">
            {streams.map((url) => {
              const embedUrl = convertToEmbedUrl(url);
              return (
                <div
                  key={url}
                  className="preview-item"
                  style={
                    activeStream === url
                      ? {
                          borderColor: "rgba(88,101,242,0.6)",
                          boxShadow: "0 0 0 1px rgba(88,101,242,0.3)",
                        }
                      : undefined
                  }
                >
                  <iframe
                    src={embedUrl}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title={url}
                    style={{ width: "100%", height: "200px", border: "none" }}
                  />
                  <div className="preview-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => setActiveStream(url)}
                    >
                      Set active
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => handleRemoveStream(url)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
