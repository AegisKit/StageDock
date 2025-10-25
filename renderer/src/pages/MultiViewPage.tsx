import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getStageDock } from "../lib/stagedock";

function normalizeUrls(input: string) {
  return input
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(
      (value, index, self) => value.length > 0 && self.indexOf(value) === index
    );
}

function toYouTubeEmbed(urlObj: URL) {
  const host = urlObj.hostname;
  const path = urlObj.pathname;

  console.log("🔍 YouTube埋め込み解析開始:", {
    originalUrl: urlObj.href,
    hostname: host,
    pathname: path,
    searchParams: Object.fromEntries(urlObj.searchParams.entries())
  });

  // 複雑な処理は一時的に無効化

  // 通常の videoId 抽出（watch/shorts/live/embed/youtu.be）
  let id = "";
  if (host.includes("youtu.be")) {
    id = urlObj.pathname.split("/").filter(Boolean)[0] || "";
    console.log("📺 youtu.be形式の動画ID:", id);
  }
  if (!id && host.includes("youtube.com")) {
    if (path.startsWith("/watch")) {
      id = urlObj.searchParams.get("v") || "";
      console.log("📺 /watch形式の動画ID:", id);
    } else if (path.startsWith("/shorts/")) {
      id = path.split("/")[2] || "";
      console.log("📺 /shorts形式の動画ID:", id);
    } else if (path.startsWith("/live/")) {
      id = path.split("/")[2] || "";
      console.log("📺 /live形式の動画ID:", id);
    } else if (path.startsWith("/embed/")) {
      id = path.split("/")[2] || "";
      console.log("📺 /embed形式の動画ID:", id);
    }
  }
  
  if (!id) {
    console.log("❌ 動画IDが取得できませんでした");
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${id}`;
  console.log("✅ 生成された埋め込みURL:", embedUrl);
  
  return embedUrl;
}

function withAltDomain(embedUrl: string) {
  return embedUrl.includes("www.youtube.com")
    ? embedUrl.replace("www.youtube.com", "www.youtube-nocookie.com")
    : embedUrl.replace("www.youtube-nocookie.com", "www.youtube.com");
}

function convertToEmbedUrl(url: string): string {
  console.log("🌐 埋め込みURL変換開始:", url);
  
  try {
    const u = new URL(url);
    console.log("🔗 URL解析結果:", {
      hostname: u.hostname,
      pathname: u.pathname,
      search: u.search
    });

    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      console.log("📺 YouTube URL検出");
      const embed = toYouTubeEmbed(u);
      if (embed) {
        console.log("✅ YouTube埋め込みURL生成成功:", embed);
        return embed;
      } else {
        console.log("❌ YouTube埋め込みURL生成失敗");
      }
    }

    if (u.hostname.includes("twitch.tv")) {
      console.log("🎮 Twitch URL検出");
      const ch = u.pathname.split("/").filter(Boolean)[0];
      const twitchUrl = `https://player.twitch.tv/?channel=${ch}&parent=localhost`;
      console.log("✅ Twitch埋め込みURL生成:", twitchUrl);
      return twitchUrl;
    }

    console.log("⚠️ 対応していないURL形式、元のURLを返します:", url);
    return url;
  } catch (error) {
    console.error("❌ URL解析エラー:", error);
    return url;
  }
}

export function MultiViewPage() {
  const [urlsInput, setUrlsInput] = useState("");
  const [streams, setStreams] = useState<string[]>([]);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  const parsedUrls = useMemo(() => normalizeUrls(urlsInput), [urlsInput]);

  const handleApply = useCallback(() => {
    const urls = normalizeUrls(urlsInput);
    setStreams(urls);
    setActiveStream(urls[0] ?? null);
  }, [urlsInput]);

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
          Paste one URL per line and StageDock will build a tailored multi-view
          window for you.
        </p>
      </div>

      <div className="panel">
        <textarea
          value={urlsInput}
          onChange={(event) => setUrlsInput(event.target.value)}
          rows={4}
          className="textarea"
          placeholder={`https://www.youtube.com/watch?v=...\nhttps://www.twitch.tv/...`}
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
                    allowFullScreen
                    title={url}
                    style={{ width: "100%", height: "200px", border: "none" }}
                    frameBorder="0"
                    onLoad={() => {
                      console.log("✅ iframe読み込み完了:", url);
                    }}
                    onError={(e) => {
                      console.error("❌ iframe読み込みエラー:", url, e);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

