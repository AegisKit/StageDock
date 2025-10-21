"use client";

import { useCallback, useMemo } from "react";
import type { CreatorWithStatus } from "../../../src/common/types.js";
import { useCreators } from "../../hooks/use-creators";
import { getStageDock } from "../../lib/stagedock";

const PLATFORM_LABELS = {
  twitch: "Twitch",
  youtube: "YouTube",
} as const;

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildChannelUrl(creator: CreatorWithStatus) {
  const rawId = creator.channelId.trim();

  if (/^https?:\/\//i.test(rawId)) {
    return rawId;
  }

  if (creator.platform === "twitch") {
    return `https://www.twitch.tv/${rawId}`;
  }

  if (rawId.startsWith("@")) {
    return `https://www.youtube.com/${rawId}`;
  }

  if (rawId.startsWith("UC")) {
    return `https://www.youtube.com/channel/${rawId}`;
  }

  return `https://www.youtube.com/@${rawId}`;
}

function sortByLiveStatus(creators: CreatorWithStatus[]) {
  return [...creators].sort((a, b) => {
    const aLive = a.liveStatus?.isLive ? 1 : 0;
    const bLive = b.liveStatus?.isLive ? 1 : 0;
    if (aLive !== bLive) {
      return bLive - aLive;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function LiveNowPage() {
  const {
    data: creators = [],
    isLoading,
    refetch,
    isRefetching,
  } = useCreators();

  const { liveCreators, offlineCreators } = useMemo(() => {
    const ordered = sortByLiveStatus(creators);
    return {
      liveCreators: ordered.filter((creator) => creator.liveStatus?.isLive),
      offlineCreators: ordered.filter((creator) => !creator.liveStatus?.isLive),
    };
  }, [creators]);

  const handleOpenExternal = useCallback((creator: CreatorWithStatus) => {
    const liveUrl =
      creator.liveStatus?.isLive && creator.liveStatus?.streamUrl
        ? creator.liveStatus.streamUrl
        : null;
    const targetUrl = liveUrl ?? buildChannelUrl(creator);
    void getStageDock().openExternal(targetUrl);
  }, []);

  const handleAddToMultiview = useCallback((creator: CreatorWithStatus) => {
    const url = buildChannelUrl(creator);
    document.dispatchEvent(
      new CustomEvent("stagedock:add-to-multiview", {
        detail: { url },
      })
    );
  }, []);

  return (
    <div className="section">
      <div className="panel">
        <div
          className="section-heading"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 className="section-title">Live now</h1>
            <p className="section-description">
              Review who is live across your favourite Twitch and YouTube
              creators.
            </p>
          </div>
          <button
            type="button"
            className="button button-outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div
          className="section-heading"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="section-title-small">Currently live</h2>
          <span className="misc-note">
            {isLoading ? "Loading..." : `${liveCreators.length} streams`}
          </span>
        </div>
        {liveCreators.length === 0 && !isLoading ? (
          <div className="empty-state">
            Nobody is live right now. Streams will appear automatically when
            they start.
          </div>
        ) : (
          <div className="card-grid columns-3">
            {liveCreators.map((creator) => (
              <article key={creator.id} className="card">
                <div className="card-meta">
                  <div className="card-heading">
                    <p
                      className="metric-label"
                      style={{ letterSpacing: "0.1em" }}
                    >
                      {PLATFORM_LABELS[creator.platform]}
                    </p>
                    <h3>{creator.displayName}</h3>
                  </div>
                  <span className="badge badge-live">Live</span>
                </div>
                <div className="card-body">
                  <span>
                    {creator.liveStatus?.title ?? "No title provided"}
                  </span>
                  <span>
                    Started {formatDate(creator.liveStatus?.startedAt)} -
                    Viewers {creator.liveStatus?.viewerCount ?? "-"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => handleOpenExternal(creator)}
                  >
                    Open in browser
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => handleAddToMultiview(creator)}
                  >
                    Add to multi-view
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div
          className="section-heading"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="section-title-small">Offline</h2>
          <span className="misc-note">
            {isLoading ? "Loading..." : `${offlineCreators.length} channels`}
          </span>
        </div>
        {offlineCreators.length === 0 && !isLoading ? (
          <div className="empty-state">All creators are offline.</div>
        ) : (
          <div className="card-grid">
            {offlineCreators.map((creator) => (
              <div key={creator.id} className="card" style={{ gap: 6 }}>
                <div className="card-heading">
                  <h3>{creator.displayName}</h3>
                  <span className="metric-caption">
                    {PLATFORM_LABELS[creator.platform]} - Last update{" "}
                    {formatDate(
                      creator.liveStatus?.updatedAt ?? creator.createdAt
                    )}
                  </span>
                </div>
                <span className="badge badge-offline">Offline</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
